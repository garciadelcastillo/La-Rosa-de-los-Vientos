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
	earliestYear: 2016,

	// Earliest month that will be parsed (inclusive)
	earliestMonth: 10,

	// Wait time between monthly database query (treat the server gently ;)
	parseWaitTime: 1,

	// Max items to download
	maxDownloadItems: 1000,  // sort of unlimited...

	// Wait time before launching the next download request (treat the server gently ;)
	downloadWaitTime: 1,

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
	timeoutDownload();
}

// Pause before starting new download, we don't want people
// at RTVE to pull the plug... ;) 
function timeoutDownload() {
	console.log("Waiting " + options.downloadWaitTime + " seconds...");
	setTimeout(downloadNextPod, options.downloadWaitTime * 1000);
}


// A function that sequentually downloads the next podcast in queue
// Based on http://stackoverflow.com/a/22907134/1934487
function downloadNextPod() {

	// Done?
	if (downloadId >= podcasts.length || downloadCount >= options.maxDownloadItems) {
		console.log("FINISHED DOWNLOADING " + downloadCount + " FILES, exiting...");
		return;
	}

	// File mngmt
	var podObj = podcasts[downloadId++];
	var fileName = sanitize(podObj.dateStr + " - " + podObj.title + (podObj.mp3url ? ".mp3" : ".mp4"));
	var downloadDir = options.downloadPath + "/" + podObj.dateArr[0];
	var dest = downloadDir + "/" + fileName;

	// Check if download path exists
	if (!fs.existsSync(downloadDir)) {
		console.log("Creating directory " + downloadDir);
		fs.mkdirSync(downloadDir);
	}

	// Timers
	var startTime = Date.now();
	console.log(" ");
	console.log((new Date()).toString());

	var downloadurl = podObj.mp3url ? podObj.mp3url :
		options.downloadMp4 ? podObj.mp4url : null;

	// Download if valid link
	if (downloadurl != null) {
		console.log("Starting download #" + downloadCount + ": " + fileName);

		var fileWriter = fs.createWriteStream(dest);
		
		// The main request
		var req = http.get(downloadurl, function(res) {

			//http://stackoverflow.com/a/20203043/1934487
			var resLen = parseInt(res.headers['content-length'], 10);
			var cur = 0;
			var total = (resLen / 1048576).toFixed(3); //1048576 - bytes in  1Megabyte
			podObj.fileSize = total;
			var perc = 0;

			res.pipe(fileWriter);
			
			// Download progress on the console
			res.on('data', function(chunk) {
				cur += chunk.length;
				perc = (100 * cur / 1048576 / total).toFixed(2);
				process.stdout.write("Downloaded " + perc + "% of " + total + " MB\r");
			})

			// Close the file, add id3 tags and timeout next download
			fileWriter.on('finish', function() {
				var duration = millisToMins(Date.now() - startTime);
				console.log("Download complete: " + podObj.fileSize + " MB in " + duration + " mins");
				downloadCount++;
				fileWriter.close(timeoutDownload);

				// node-id3 is having a hard time writing tags to big files?!?! 
				// Looks like a version problem: v.6.9.2 doesn't work, downgrading to 5.12.0 makes tis work... 

				// Write id3 tags
				if (writeID3Tags && podObj.mp3url) {
					var tags = {
						title: podObj.dateStr + " - " + podObj.title,
						artist: "Onda Cero",
						year: podObj.dateArr[0].toString()  // node-id3 doesn't support non-string values as of v0.0.7
						// comment: podObj.detail  			// not supported by node-id3
					};

					var success = nodeID3.write(tags, dest);
					if (success) console.log("Successfuly written tags");
				}
			});
		
		}).on('error', function(err) {
			fs.unlink(dest);

			console.log("ERROR DOWNLOADING " + fileName);
			console.log(err.message);

			timeoutDownload();  // continue with next
		});


	} else {
		console.log("Skipping " + fileName + " --> no valid download file");
		downloadNextPod();  // continue with next

	}
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
		
		// this.dateStr = this.dateArr.join("-");
		this.dateStr = dateArrToString(this.dateArr, "-");

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

			// this.dateStr = this.dateArr.join("-");
			this.dateStr = dateArrToString(this.dateArr, "-");
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


function dateArrToString(arr, joinChar) {
	var y = arr[0].toString();
	var m = arr[1].toString();
	while (m.length < 2) m = "0" + m;
	var d = arr[2].toString();
	while (d.length < 2) d = "0" + d;

	return y + joinChar + m + joinChar + d;
}



