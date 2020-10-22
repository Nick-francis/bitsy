/* PALETTE TOOL STUFF
TODO:
- is PaletteTool the best name?
- should it create its own color picker?
*/
function PaletteTool(colorPicker,labelIds,nameFieldId) {
	var self = this;

	var colorPickerIndex = 0;

	var curPaletteId = sortedPaletteIdList()[0];

	function UpdatePaletteUI() {
		// update name field
		var palettePlaceholderName = localization.GetStringOrFallback("palette_label", "palette");
		document.getElementById(nameFieldId).placeholder = palettePlaceholderName + " " + GetSelectedId();
		var pal = palette[GetSelectedId()];
		if (pal && pal.name) {
			document.getElementById(nameFieldId).value = name;
		}
		else {
			document.getElementById(nameFieldId).value = "";
		}

		updateColorPickerUI();
	}

	events.Listen("game_data_change", function(event) {
		// make sure we have valid palette id
		if (palette[curPaletteId] === undefined) {
			if (sortedPaletteIdList().length > 0) {
				curPaletteId = sortedPaletteIdList()[0];
			}
			else {
				curPaletteId = null;
			}
		}

		UpdatePaletteUI();
	});

	// public
	function changeColorPickerIndex(index) {
		colorPickerIndex = index;
		var color = getPal(GetSelectedId())[ index ];
		// console.log(color);
		colorPicker.setColor( color[0], color[1], color[2] );
	}
	this.changeColorPickerIndex = changeColorPickerIndex;

	function updateColorPickerLabel(index, r, g, b) {
		var rgbColor = {r:r, g:g, b:b};

		var rgbColorStr = "rgb(" + rgbColor.r + "," + rgbColor.g + "," + rgbColor.b + ")";
		var hsvColor = RGBtoHSV( rgbColor );
		document.getElementById( labelIds[ index ] ).style.background = rgbColorStr;

		document.getElementById(labelIds[ index ])
			.setAttribute("class", hsvColor.v < 0.5 ? "colorPaletteLabelDark" : "colorPaletteLabelLight");
	}

	// public
	function updateColorPickerUI() {
		var color0 = getPal(GetSelectedId())[ 0 ];
		var color1 = getPal(GetSelectedId())[ 1 ];
		var color2 = getPal(GetSelectedId())[ 2 ];

		updateColorPickerLabel(0, color0[0], color0[1], color0[2] );
		updateColorPickerLabel(1, color1[0], color1[1], color1[2] );
		updateColorPickerLabel(2, color2[0], color2[1], color2[2] );

		changeColorPickerIndex( colorPickerIndex );
	}
	this.updateColorPickerUI = updateColorPickerUI;

	events.Listen("color_picker_change", function(event) {
		getPal(GetSelectedId())[ colorPickerIndex ][ 0 ] = event.rgbColor.r;
		getPal(GetSelectedId())[ colorPickerIndex ][ 1 ] = event.rgbColor.g;
		getPal(GetSelectedId())[ colorPickerIndex ][ 2 ] = event.rgbColor.b;

		updateColorPickerLabel(colorPickerIndex, event.rgbColor.r, event.rgbColor.g, event.rgbColor.b );

		if (event.isMouseUp && !events.IsEventActive("game_data_change")) {
			events.Raise("palette_change", { id: curPaletteId }); // TODO -- try including isMouseUp and see if we can update more stuff live
		}
	});

	function SelectPrev() {
		var idList = sortedPaletteIdList();
		var index = idList.indexOf(curPaletteId);

		index--;
		if (index < 0) {
			index = idList.length - 1;
		}

		events.Raise("select_palette", { id: idList[index] });
	}
	this.SelectPrev = SelectPrev;

	this.SelectNext = function() {
		var idList = sortedPaletteIdList();
		var index = idList.indexOf(curPaletteId);

		index++;
		if (index >= idList.length) {
			index = 0;
		}

		events.Raise("select_palette", { id: idList[index] });
	}

	this.AddNew = function() {
		// create new palette and save the data
		var id = nextPaletteId();

		var randomColors = [
			hslToRgb(Math.random(), 1.0, 0.5),
			hslToRgb(Math.random(), 1.0, 0.5),
			hslToRgb(Math.random(), 1.0, 0.5) ];

		palette[id] = createPalette(id, null, randomColors);

		events.Raise("add_palette", { id: id });
		events.Raise("select_palette", { id: id });
		events.Raise("palette_list_change");
	}

	this.AddDuplicate = function() {
		var sourcePalette = palette[curPaletteId] === undefined ? null : palette[curPaletteId];
		var curColors = sourcePalette.colors;

		var id = nextPaletteId();
		var dupeColors = [];

		for (var i = 0; i < curColors.length; i++) {
			dupeColors.push(curColors[i].slice());
		}

		palette[id] = createPalette(id, null, dupeColors);

		events.Raise("add_palette", { id: id });
		events.Raise("select_palette", { id: id });
		events.Raise("palette_list_change");
	}

	this.DeleteSelected = function() {
		if (sortedPaletteIdList().length <= 1) {
			alert("You can't delete your only palette!");
		}
		else if (confirm("Are you sure you want to delete this palette?")) {
			delete palette[curPaletteId];

			// replace palettes for rooms using the current palette
			var replacementPalId = sortedPaletteIdList()[0];
			var roomIdList = sortedRoomIdList();
			for (var i = 0; i < roomIdList.length; i++) {
				var roomId = roomIdList[i];
				if (room[roomId].pal === curPaletteId) {
					room[roomId].pal = replacementPalId;
				}
			}

			SelectPrev();

			events.Raise("delete_palette", { id: id });

			events.Raise("palette_list_change");
		}
	}

	function GetSelectedId() {
		return curPaletteId;
	}
	this.GetSelectedId = GetSelectedId;

	this.ChangeSelectedPaletteName = function(name) {
		var pal = palette[ GetSelectedId() ];

		if (pal) {
			if(name.length > 0) {
				pal.name = name;
			}
			else {
				pal.name = null;
			}

			updateNamesFromCurData() // TODO ... this should really be an event?

			events.Raise("change_palette_name", { id: pal.id, name: pal.name });
			events.Raise("palette_list_change");
		}
	}

	// init yourself
	UpdatePaletteUI();

	events.Listen("select_palette", function(e) {
		curPaletteId = e.id;
		UpdatePaletteUI();
	});
}