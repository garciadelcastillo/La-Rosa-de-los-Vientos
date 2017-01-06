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
	currentYear: 2016,

	// Last publishing month in the above year, will start parsing back from here 
	currentMonth: 10,

	// Wait time between monthly database query (treat the server gently ;)
	parseWaitTime: 5,

	// Wait time before launching the next download request (treat the server gently ;)
	downloadWaitTime: 60,

	// Absolute or relative target download path
	downloadPath: "./downloads",
	// downloadPath: "C:/downloads"

	// Override default id3 tags on mp3 with custom podcast data?
	writeID3Tags: true

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
var dbURL = "http://www.ondacero.es/json/audio/8502/";


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
parseDB(dbURL, options.currentYear, options.currentMonth);


function parseDB(baseURL, lastYear, lastMonth) {

	var y = lastYear,
		m = lastMonth;

	var url = baseURL + "complete_programs_" + y + "_" + pad(m, 2) + ".json";

	console.log(url);

	var body;

	var request = http.get(url, function(res) {

		res.on('data', function(chunk) {
			body += chunk;
		});

		res.on('end', function() {
			console.log("Done fetching " + url);

			// console.log("");
			// console.log("RAW BODY");
			// console.log(body);

			// The response object comes with a leading "undefined" for some reason...
			// get rid of this...
			body = body.slice(9);  // quick and dirty

			// console.log("");
			// console.log("JSON OBJ:");
			var json = JSON.parse(body);
			// console.log(json);

			for (var i = 0; i < json.length; i++) {
				podcasts.push(new Podcast(json[i]));
			}

			console.log(podcasts);

		})

	}).on('error', function(err) {
		console.log("Error requesting " + url);
		console.log(err);
	});
}










///////////
// UTILS //
///////////


// A class representing a podcast element constructed via the json object parsed from the DB
function Podcast(obj) {

	this.id = obj["id"];
	this.title = obj["title"].match(/.+?(?=\s\d)/g)[0];
	this.detail =  obj["description"];

	this.duration = parseFloat(obj["duration"]);  // in secs
	this.durationStr = secsToTimeString(this.duration);

	var dateObj = titleToDate(obj["title"]);
	this.dateStr = dateObj.dateStr;
	this.dateArr = dateObj.dateArr;

	this.mp3url = obj["source"]["mp3"];

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

function titleToDate(str) {
	var obj = {};
	var m = str.match(/\d+?\/\d+?\/\d+?$/g);  // https://regex101.com/r/0NY5N8/1
	if (m == null) return undefined;

	obj.dateStr = m[0];

	var arr = obj.dateStr.split("/");
	obj.dateArr = [];
	obj.dateArr[0] = arr[2];
	obj.dateArr[1] = arr[1];
	obj.dateArr[2] = arr[0];

	return obj;
}



