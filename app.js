/*

██████╗  ██████╗ ███████╗ █████╗     ██╗   ██╗██╗███████╗███╗   ██╗████████╗ ██████╗ ███████╗
██╔══██╗██╔═══██╗██╔════╝██╔══██╗    ██║   ██║██║██╔════╝████╗  ██║╚══██╔══╝██╔═══██╗██╔════╝
██████╔╝██║   ██║███████╗███████║    ██║   ██║██║█████╗  ██╔██╗ ██║   ██║   ██║   ██║███████╗
██╔══██╗██║   ██║╚════██║██╔══██║    ╚██╗ ██╔╝██║██╔══╝  ██║╚██╗██║   ██║   ██║   ██║╚════██║
██║  ██║╚██████╔╝███████║██║  ██║     ╚████╔╝ ██║███████╗██║ ╚████║   ██║   ╚██████╔╝███████║
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝      ╚═══╝  ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚══════╝

A batch downloader and renamer for the podcast series of "La Rosa de los Vientos": 
	http://www.ondacero.es/programas/la-rosa-de-los-vientos/

*/

// This is just for reference, the real main one will be derived from a table page loader AJAX req url
var baseURL = "http://www.ondacero.es/programas/la-rosa-de-los-vientos/";

// Main configuration object, use these properties to customize download options
var options = {
	
	// Last publishing year, will start parsing back from here
	currentYear: 2017,

	// Last publishing month in the above year, will start parsing back from here 
	currentMonth: 1,

	// Earliest year that will be parsed (inclusive)
	earliestYear: 2011,

	// Earliest month that will be parsed (inclusive)
	earliestMonth: 4,

	// Wait time between monthly database query (treat the server gently ;)
	parseWaitTime: 1,

	// Wait time before launching the next download request (treat the server gently ;)
	downloadWaitTime: 60,

	// Absolute or relative target download path
	downloadPath: "./downloads",
	// downloadPath: "C:/downloads"

	// Override default id3 tags on mp3 with custom podcast data?
	writeID3Tags: true,

	// Some older podcasts are not available in mp3 format, download mp4?
	downloadMp4: true

};




//////////////////////////////////////////////////////////////
// UNLESS YOU KNOW WHAT YOU ARE DOING, DON'T TOUCH BELOW ;) // 
//////////////////////////////////////////////////////////////

// Load modules
var http = require('http');
var fs = require('fs');
var util = require('util');
var sanitize = require('sanitize-filename');
var nodeID3 = require('node-id3');

// Some process vars
var podcasts = [];
var downloadId = 0;
var downloadCount = 0;

// This base URL contains monthly JSON files with podcast data in the form of
// "http://www.ondacero.es/json/audio/8502/complete_programs_2017_01.json"
var dbUrl = "http://www.ondacero.es/json/audio/8502/";

// Check if download path exists
if (!fs.existsSync(options.downloadPath)) {
	console.log("Creating directory " + options.downloadPath);
	fs.mkdirSync(options.downloadPath);
}

// Initialize a console + file logger: http://stackoverflow.com/a/21061306/1934487
var log_file = fs.createWriteStream(options.downloadPath + '/log.txt', {flags : 'w'});  // choose 'a' to add to the existing file instead
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
				startDownloads();
		});

	}).on('error', function(err) {
		console.log("Error requesting " + url);
		console.log(err);

		failed++;
		if (failed < 3) {
			if (tickMonth()) 
				timeoutParse();
			else 
				startDownloads();
		} else {

			console.log(podcasts);

			console.log(" ");
			console.log("Done parsing " + parsed + " podcasts");
			console.log("Starting downloads");

			// start downloading	
			startDownloads();
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
	return !(y <= options.earliestYear && m < options.earliestMonth);

	// if (y <= options.earliestYear && m < options.earliestMonth) {
	// 	return false;
	// } else {
	// 	return true;
	// }

}

function timeoutParse() {
	console.log("Waiting " + options.parseWaitTime + " seconds...");
	setTimeout(parseNextMonth, options.parseWaitTime + 1000);
}



function startDownloads() {
	console.log(podcasts);
}











///////////
// UTILS //
///////////


// A class representing a podcast element constructed via the json object parsed from the DB
function Podcast(obj) {

	this.id = obj["id"];

	// PARSE DATE
	// Some objects have a date property with UNIX timestamp, 
	// others don't and have the date on the title
	if (obj["date"]) {
		var date = new Date(obj["date"]);
		
		this.dateArr = [];
		this.dateArr[0] = date.getFullYear();
		this.dateArr[1] = date.getMonth() + 1;  // months start at 0
		this.dateArr[2] = date.getDate();
		
		this.dateStr = this.dateArr.join("-");

	} else {
		// Otherwise, get it from the title if any
		var m = str.match(/\d+?\/\s*\d+?\/\s*\d+/g);  // https://regex101.com/r/0NY5N8/3

		// If bad formatting, use placeholder for 
		if (m == null) {
			console.log("  --> WEIRD DATE " + obj["id"] + " " + obj["title"]);
			this.dateStr = "yyyy-mm-dd";
			this.dateArr = [1990, 1, 1];

		} else {
			// On some podcasts the date reads "dd/ mm/ yyyy", fix it
			var arr = m[0].split(" ").join("/").split("/");  // quick ad dirty

			this.dateArr = [];
			this.dateArr[0] = parseInt(arr[2]);
			this.dateArr[1] = parseInt(arr[1]);
			this.dateArr[2] = parseInt(arr[0]);

			this.dateStr = this.dateArr.join("-");

		}

	}

	// PARSE TITLE
	// var m = obj["title"].match(/.+?(?=\s\d)/g);
	// if (m == null) {
	// 	console.log("  --> WEIRD TITLE " + obj["id"] + " " + obj["title"]);
	// 	this.title = "FOO";

 // 	} else {
 // 		this.title = m[0];

 // 	}

 	// Title is inconsistent, and pretty much useless. 
 	// Replaced by static title
 	this.title = "La Rosa de los Vientos";

	this.detail =  obj["description"];

	if (obj["duration"]) {
		this.duration = parseFloat(obj["duration"]);  // in secs
		this.durationStr = secsToTimeString(this.duration);
	
	} else {
		// console.log("  --> NO DURATION " + obj["id"] + " " + obj["title"]);
		this.duration = 0;
		this.durationStr = "0:00:00";

	}

	// Older podcasts are only available in mp4 format...
	if (obj["source"]["mp3"]) {
		this.mp3url = obj["source"]["mp3"];

	} else {
		if (obj["source"]["mp4"]) {
			this.mp4url = obj["source"]["mp4"];

		} else {
			console.log("  --> No mp3 || mp4 link " + obj["id"] + " " + obj["title"]);

		}
	}




	this.toString = function() {
		return "" 
			+ this.dateArr.join("-") + " " + this.title + "\r\n"
			+ this.durationStr + "\r\n"
			+ this.detail + "\r\n"
			+ this.mp3url;

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

// Seconds to String conversion
function secsToTimeString(secs) {
	var s = "" + Math.round(secs % 60);
	if (s.length < 2) s = "0" + s;
	var m = "" + Math.floor( (secs / 60) % 60);
	if (m.length < 2) m = "0" + m;
	var h = "" + Math.floor(secs / 3600);
	return h + ":" + m + ":" + s;
}



// Number to string conversion
function millisToMins(millis) {
	var m = "" + Math.floor(millis / 60000);
	while (m.length < 2) m = "0" + m;
	var s =  "" + Math.round((millis % 60000) / 1000);
	while (s.length < 2) s = "0" + s;
	return m + ":" + s;
}





