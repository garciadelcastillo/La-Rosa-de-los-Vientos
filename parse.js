// ██████╗  ██████╗ ███████╗ █████╗     ██╗   ██╗██╗███████╗███╗   ██╗████████╗ ██████╗ ███████╗
// ██╔══██╗██╔═══██╗██╔════╝██╔══██╗    ██║   ██║██║██╔════╝████╗  ██║╚══██╔══╝██╔═══██╗██╔════╝
// ██████╔╝██║   ██║███████╗███████║    ██║   ██║██║█████╗  ██╔██╗ ██║   ██║   ██║   ██║███████╗
// ██╔══██╗██║   ██║╚════██║██╔══██║    ╚██╗ ██╔╝██║██╔══╝  ██║╚██╗██║   ██║   ██║   ██║╚════██║
// ██║  ██║╚██████╔╝███████║██║  ██║     ╚████╔╝ ██║███████╗██║ ╚████║   ██║   ╚██████╔╝███████║
// ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝      ╚═══╝  ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚══════╝

// A database parser for the podcast series of "La Rosa de los Vientos": 
// 	http://www.ondacero.es/programas/la-rosa-de-los-vientos/


// Main configuration object, use these properties to customize parsing options
var options = {

	// This is just for reference ;)
	baseURL: "http://www.ondacero.es/programas/la-rosa-de-los-vientos/",

	// Name used for filenames and stuff
	projectName: 'la-rosa-de-los-vientos',

	// Last publishing year, will start parsing back from here
	currentYear: 2017,

	// Last publishing month in the above year, will start parsing back from here 
	currentMonth: 1,

	// Earliest year that will be parsed (inclusive)
	earliestYear: 2011,

	// Earliest month that will be parsed (inclusive)
	earliestMonth: 1,

	// The folder that will contain the output json file
	parsingPath: "./parsing",
	
	// Wait time between monthly database query (treat the server gently ;)
	parseWaitTime: 10

};



//////////////////////////////////////////////////////////////
// UNLESS YOU KNOW WHAT YOU ARE DOING, DON'T TOUCH BELOW ;) // 
//////////////////////////////////////////////////////////////

// Load modules
var http = require('http');
var fs = require('fs');
var util = require('util');

// Some process vars
var podcasts = [];

// This base URL contains monthly JSON files with podcast data in the form of
// "http://www.ondacero.es/json/audio/8502/complete_programs_2017_01.json"
var dbUrl = "http://www.ondacero.es/json/audio/8502/";

// Check if download path exists
if (!fs.existsSync(options.parsingPath)) {
	console.log("Creating directory " + options.parsingPath);
	fs.mkdirSync(options.parsingPath);
}

// Initialize a console + file logger: http://stackoverflow.com/a/21061306/1934487
var log_file = fs.createWriteStream(options.parsingPath + '/' + options.projectName + '.log', {flags : 'w'});  // choose 'a' to add to the existing file instead
var log_stdout = process.stdout;
console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};


// Let's go!
console.log("STARTING DATABASE PARSE on " + new Date());

var y = options.currentYear,
	m = options.currentMonth,
	failed = 0,
	parsed = 0;

parseNextMonth();


function parseNextMonth() {
	
	var url = dbUrl + "complete_programs_" + y + "_" + pad(m, 2) + ".json";
	console.log("Parsing " + url);

	var body;
	var request = http.get(url, function(res) {

		res.on('data', function(chunk) {
			body += chunk;
		});

		res.on('end', function() {
			console.log("Done fetching " + url);

			// The response object comes with a leading "undefined" for some reason...
			// get rid of this...
			body = body.slice(9);  // quick and dirty
			var json = JSON.parse(body);

			for (var i = 0; i < json.length; i++) {
				podcasts.push(new Podcast(json[i]));
				parsed++;
			}

			if (tickMonth()) 
				timeoutParse();
			else
				exportPodcasts();
		});

	}).on('error', function(err) {
		console.log("Error requesting " + url);
		console.log(err);

		failed++;
		if (failed < 3) {
			if (tickMonth()) 
				timeoutParse();
			else 
				exportPodcasts();

		} else {
			console.log(podcasts);
			console.log(" ");
			console.log("Done parsing " + parsed + " podcasts");
			console.log("Starting downloads");

			exportPodcasts();
		}
	});
}

function tickMonth() {
	m--;
	if (m == 0) {
		m = 12;
		y--;
	}

	// Return true if still within boundaries
	return !(y < options.earliestYear || (y == options.earliestYear && m < options.earliestMonth));
}

function timeoutParse() {
	console.log("Waiting " + options.parseWaitTime + " seconds...");
	setTimeout(parseNextMonth, options.parseWaitTime + 1000);
}


function exportPodcasts() {
	// JSON,stringify accepts 'prettyfication' via space count on its third argument
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toJSON
	fs.writeFile(options.parsingPath + '/' + options.projectName + '.json', JSON.stringify(podcasts, null, 2), "utf8");  
}










///////////
// UTILS //
///////////

// A class representing a podcast element constructed via the json object parsed from the DB
function Podcast(obj) {

	this.source = obj;

	// DATE PARSING
	// Will try to parse the title first, otherwise parse the timestamp, otherwise no timestamp
	var millis;
	var dateMatch = obj["title"].match(/\d+?\/\s*\d+?\/\s*\d+/g);  // https://regex101.com/r/0NY5N8/3
	if (dateMatch == null) {
		// If no match, try timestamp
		if (obj["date"]) {
			millis = parseInt(obj["date"]);
		} else {
			// If bad formatting, flag the timestamp 
			console.log("  --> WEIRD DATE " + obj["id"] + " " + obj["title"]);
			millis = 0;
		}

	} else {
		// On some podcasts the date reads "dd/ mm/ yyyy", fix it
		var arr = dateMatch[0].split(" ").join("").split("/");  // very quick & dirty... lol

		millis = Date.UTC(parseInt(arr[2]), parseInt(arr[1]) - 1, parseInt(arr[0]));  // remember months are zero-based
	}
	this.timestamp = millis;



 	// Title is inconsistent, and pretty much useless. Replaced by static title
 	this.title = "La Rosa de los Vientos " + dateToString(this.timestamp, "-");

 	this.author = "Onda Cero"

	this.detail = obj["description"];

	this.url = obj["url"];

	if (obj["duration"]) {
		this.duration = Math.round(parseFloat(obj["duration"]));  // in secs
	} else {
		this.duration = -1;
	}

	this.file = {};

	// Older podcasts are only available in mp4 format...
	if (obj["source"]["mp3"]) {
		this.file.type = "mp3";
		this.file.url = obj["source"]["mp3"];

	} else if (obj["source"]["mp4"]) {
		this.file.type = "mp4";
		this.file.url = obj["source"]["mp4"];

	} else if (obj["source"]["ogg"]) {
		this.file.type = "ogg";
		this.file.url = obj["source"]["ogg"];

	} else {
		console.log("  --> No valid audio file link " + obj["id"] + " " + obj["title"]);
		this.file.type = "";
		this.file.url = "";

	}

	this.toString = function() {
		return "" +
			+ this.timestamp.toUTCString() + " " + this.timestamp + "\r\n"
			+ this.author + " - " + this.title + "\r\n"
			+ this.detail + "\r\n"
			+ this.duration + "\r\n"
			+ this.file.url;

	}

	// Node uses the default 'inspect' on console logs: http://stackoverflow.com/a/33469852/1934487
	this.inspect = this.toString;
}


// http://stackoverflow.com/a/2998822/1934487
function pad(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

function dateToString(timestamp, joinChar) {
	var joinChar = joinChar || "-";
	var arr = new Date(timestamp).toJSON().split("T")[0].split("-");
	return arr[0] + joinChar + arr[1] + joinChar + arr[2];
}

// Seconds to String conversion
function secsToTimeString(secs) {
	var s = "" + Math.round(secs % 60);
	if (s.length < 2) s = "0" + s;
	var m = "" + Math.floor( (secs / 60) % 60);
	if (m.length < 2) m = "0" + m;
	var h = "" + Math.floor(secs / 3600);
	return h + ":" + m + ":" + s;
}


