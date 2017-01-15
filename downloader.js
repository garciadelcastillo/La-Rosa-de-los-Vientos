// ██████╗  ██████╗ ██╗    ██╗███╗   ██╗██╗      ██████╗  █████╗ ██████╗ ███████╗██████╗ 
// ██╔══██╗██╔═══██╗██║    ██║████╗  ██║██║     ██╔═══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗
// ██║  ██║██║   ██║██║ █╗ ██║██╔██╗ ██║██║     ██║   ██║███████║██║  ██║█████╗  ██████╔╝
// ██║  ██║██║   ██║██║███╗██║██║╚██╗██║██║     ██║   ██║██╔══██║██║  ██║██╔══╝  ██╔══██╗
// ██████╔╝╚██████╔╝╚███╔███╔╝██║ ╚████║███████╗╚██████╔╝██║  ██║██████╔╝███████╗██║  ██║
// ╚═════╝  ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝

// A batch downloader of podcast files




// File containing the JSON representation of the podcast objects
var db = "podcasts.json";

// Main configuration object, use these properties to customize download options
var options = {
	
	// Nothing before this date will be downloaded ("yyyy-mm-dd")
	startDate: "2011-01-01",

	// Nothing after this date will be downloade ("yyyy-mm-dd")
	endDate: "2017-12-31",

	// Max items to download
	maxDownloadItems: 1000, 

	// Wait time in seconds before launching the next download request (treat the server gently ;)
	downloadWaitTime: 5,

	// Absolute or relative target download path
	downloadPath: "./downloads",
	// downloadPath: "C:/downloads"

	// File types that will be dowloaded
	filetypes: {
		"mp3": true, 
		"mp4": true,
		"ogg": false
	},
	
	// Override default id3 tags on mp3 with custom podcast data?
	writeID3Tags: true,

	// By default, the app downloads the podcasts from the most recent to the oldest.
	// Set randomizeDownloads to true to download them in random order (no repetitions guaranteed)
	randomizeDownloads: true
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
var downloadId = 0;
var downloadCount = 0;

// Convert dates to timestamps for comparison
(function() {
	var arr = options.startDate.split("-");
	if (arr.length == 3) {
		options.startTimestamp = Date.UTC(parseInt(arr[0]), parseInt(arr[1]) - 1, parseInt(arr[2]));
	} else {
		console.log("Bad startDate format, exiting...");
		process.exit(1);
	}

	arr = options.endDate.split("-");
	if (arr.length == 3) {
		options.endTimestamp = Date.UTC(parseInt(arr[0]), parseInt(arr[1]) - 1, parseInt(arr[2]));
	} else {
		console.log("Bad endDate format, exiting...");
		process.exit(1);
	}
})();  // IIFE to scope process vars


// Check if download path exists
if (!fs.existsSync(options.downloadPath)) {
	console.log("Creating directory " + options.downloadPath);
	fs.mkdirSync(options.downloadPath);
}

// Initialize a console + file logger: http://stackoverflow.com/a/21061306/1934487
var log_file = fs.createWriteStream(options.downloadPath + '/download.log', {flags : 'w'});  // choose 'a' to add to the existing file instead
var log_stdout = process.stdout;
console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

// Load the podcasts from the file
// Do not use _require_, do sync readfile instead: http://stackoverflow.com/a/25710749/1934487
console.log("Loading podcasts from " + db);
var json;
try {
	json = fs.readFileSync(__dirname + '/' + db, 'utf8');
} catch (err) {
	console.log("ERROR loading " + db);
	console.log(err);
	process.exit(1);	
}

// Parse them into a json object
console.log("Parsing podcasts...");
var podcasts = JSON.parse(json);

// Choose between sequential or random download order:
var downloadOrder = [];  // stores the sequential indices of the downloads
for (var i = 0; i < podcasts.length; i++) {
	downloadOrder.push(i);
}

if (options.randomizeDownloads) {
	downloadOrder = shuffle(downloadOrder);
}


// Let's go!
console.log("STARTING FILE DOWNLOAD on " + new Date());
startDownloads();







/////////////////////////////////////////////////////////////
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

	// Retrieve the podcast object
	var podObj = podcasts[downloadOrder[downloadId++]];

	// Dating
	var date = new Date(podObj.timestamp);
	if (podObj.timestamp < options.startTimestamp || podObj.timestamp > options.endTimestamp) {
		console.log("Skipping podcast '" + podObj.title + "':");
		console.log("  --> Date is out of range: " + new Date(podObj.timestamp));
		downloadNextPod();
		return;
	}

	// Skip if not valid format
	if (!options.filetypes[podObj.file.type]) {
		console.log("Skipping podcast '" + podObj.title + "':");
		console.log("  --> Invalid file format: " + podObj.file.type);
		downloadNextPod();
		return;
	}

	// File mngmt
	// var fileName = sanitize(podObj.dateStr + " - " + podObj.title + (podObj.mp3url ? ".mp3" : ".mp4"));
	var fileName = sanitize(dateToString(podObj.timestamp, "-") + " - " + podObj.title + "." + podObj.file.type);
	var downloadDir = options.downloadPath + "/" + date.getUTCFullYear();
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

	var downloadUrl = podObj.file.url;

	// Download if valid link
	if (downloadUrl != null) {
		console.log("Starting download #" + downloadCount + ": " + fileName);

		var fileWriter = fs.createWriteStream(dest);
		
		// The main request
		var req = http.get(downloadUrl, function(res) {

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

				// Write id3 tags
				if (options.writeID3Tags && podObj.file.type == "mp3") {
					var tags = {
						title: podObj.title,
						artist: podObj.author,
						year: date.getUTCFullYear(),  
						comment: { 
							language: "eng", 
							text: podObj.detail + " - " + podObj.url
						}
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


function dateToString(timestamp, joinChar) {
	var joinChar = joinChar || "-";
	var arr = new Date(timestamp).toJSON().split("T")[0].split("-");
	return arr[0] + joinChar + arr[1] + joinChar + arr[2];
}

// Number to string conversion
function millisToMins(millis) {
	var m = "" + Math.floor(millis / 60000);
	while (m.length < 2) m = "0" + m;
	var s =  "" + Math.round((millis % 60000) / 1000);
	while (s.length < 2) s = "0" + s;
	return m + ":" + s;
}

function shuffle(array) {
  var m = array.length, t, i;

  // While there remain elements to shuffle…
  while (m) {

    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}