/*
TODO:
- untangle local & external resource use in font manager (still more to do here)
- variable width & height characters
	- how should this be represented in game data?

infer width / height?
CHAR a
OFFSET x y
****
****
****

explicit
CHAR a
SIZE x y
OFFSET x y
***
***
***

properties block
CHAR a
PROPERTIES
SIZE x y
OFFSET x y
ENDPROPERTIES
***
***
***
*/

function FontManager(useExternalResources) {

if (useExternalResources === undefined || useExternalResources === null) {
	useExternalResources = false;
}

var self = this;

var fontExtension = ".bitsyfont";
this.GetExtension = function() {
	return fontExtension;
}

// place to store font data that is part of the local game data
var localResources = {};

// place to store font data fetched from a server (only used in editor)
var externalResources = null;
if (useExternalResources) {
	externalResources = new ResourceLoader();// NOTE : this class doesn't exist in exported game
}

this.LoadResources = function(filenames, onLoadAll) {
	if (!useExternalResources)
		return;

	// TODO : is this being called too many times?
	var onLoad = function() {
		var count = externalResources.getResourceLoadedCount();

		if (count >= filenames.length && onLoadAll != null) {
			onLoadAll();
		}
	}

	for (var i = 0; i < filenames.length; i++) {
		externalResources.load("bitsyfont", filenames[i], onLoad);
	}
}

// manually add resource
this.AddResource = function(filename, fontdata) {
	if (useExternalResources) {
		externalResources.set(filename, fontdata);
	}
	else {
		localResources[filename] = fontdata;
	}
}

this.ContainsResource = function(filename) {
	if (useExternalResources) {
		return externalResources.contains(filename);
	}
	else {
		return localResources[filename] != null;
	}
}

function GetData(fontName) {
	if (useExternalResources) {
		return externalResources.get(fontName + fontExtension);
	}
	else {
		return localResources[fontName + fontExtension];
	}
}
this.GetData = GetData;

function Create(fontData) {
	return new Font(fontData);
}
this.Create = Create;

this.Get = function(fontName) {
	var fontData = self.GetData(fontName);
	return self.Create(fontData);
}

function Font(fontData) {
	var name = "unknown";
	var width = 6; // default size so if you have NO font or an invalid font it displays boxes
	var height = 8;
	var chardata = {};
	var invalidCharData = [];

	this.getName = function() {
		return name;
	}

	this.getData = function() {
		return chardata;
	}

	this.getWidth = function() {
		return width;
	}

	this.getHeight = function() {
		return height;
	}

	this.hasChar = function(char) {
		var codepoint = char.charCodeAt(0);
		return chardata[codepoint] != null;
	}

	this.getChar = function(char) {

		var codepoint = char.charCodeAt(0);

		if (chardata[codepoint] != null) {
			return chardata[codepoint];
		}
		else {
			return invalidCharData;
		}
	}

	function parseFont(fontData) {
		if (fontData == null)
			return;

		var lines = fontData.split("\n");

		var isReadingChar = false;
		var isReadingCharProperties = false;
		var curCharLineCount = 0;
		var curCharCode = 0;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			if (!isReadingChar) {
				// READING NON CHARACTER DATA LINE
				var args = line.split(" ");
				if (args[0] == "FONT") {
					name = args[1];
				}
				else if (args[0] == "SIZE") {
					width = parseInt(args[1]);
					height = parseInt(args[2]);
				}
				else if (args[0] == "CHAR") {
					isReadingChar = true;
					isReadingCharProperties = true;
					curCharLineCount = 0;
					curCharCode = parseInt(args[1]);
					chardata[curCharCode] = { width:width, height:height, data:[] };
				}
			}
			else {
				// CHAR PROPERTIES
				if (isReadingCharProperties) {
					var args = line.split(" ");
					if (args[0] == "SIZE") {
						// CUSTOM CHAR SIZE
						chardata[curCharCode].width = parseInt(args[1]);
						chardata[curCharCode].height = parseInt(args[2]);
					}
					else if (args[0] == "OFFSET") {
						// CUSTOM CHAR OFFSET
						// // TODO
					}
					else {
						isReadingCharProperties = false;
					}
				}

				// CHAR DATA
				if (!isReadingCharProperties) {
					// READING CHARACTER DATA LINE
					// for (var j = 0; j < width; j++)
					for (var j = 0; j < chardata[curCharCode].width; j++)
					{
						chardata[curCharCode].data.push( parseInt(line[j]) );
					}

					curCharLineCount++;
					if (curCharLineCount >= height) {
						isReadingChar = false;
					}
				}
			}
		}

		// init invalid character box
		invalidCharData = [];
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				if (x < width-1 && y < height-1) {
					invalidCharData.push(1);
				}
				else {
					invalidCharData.push(0);
				}
			}
		}
	}

	parseFont(fontData);
}

} // FontManager