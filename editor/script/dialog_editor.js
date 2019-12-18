/* 
TODO 
- wait to trigger functions until all text has been displayed!
- I need to probably rethink the layout of the paint tool still...
	- remove the weird hacky formatting exceptions for margins, etc
*/

// TODO : name?
function DialogTool() {
	this.CreateEditor = function(dialogId) {
		return new DialogScriptEditor(dialogId);
	}

	this.CreatePlaintextEditor = function(dialogId, style) {
		return new PlaintextDialogScriptEditor(dialogId, style);
	}

	// todo : name?
	this.CreateWidget = function(label, dialogId, allowNone, onChange, creationOptions) {
		return new DialogWidget(label, dialogId, allowNone, onChange, creationOptions);
	}

	// TODO later? edit multi-line titles
	// this.CreateTitleEditor = function() {
	// 	// TODO	
	// }

	// TODO : label should be label localization id
	function DialogWidget(label, dialogId, allowNone, onChange, creationOptions) {
		var showSettings = false;

		var div = document.createElement("div");
		div.classList.add("controlBox");

		var controlDiv = document.createElement("div");
		controlDiv.style.display = "flex"; // todo : style
		div.appendChild(controlDiv);

		var labelSpan = document.createElement("span");
		labelSpan.style.flexGrow = 1;
		labelSpan.innerHTML = '<i class="material-icons">chat</i> ' + label;
		controlDiv.appendChild(labelSpan);

		var settingsButton = document.createElement("button");
		settingsButton.innerHTML = '<i class="material-icons">settings</i>';
		controlDiv.appendChild(settingsButton);

		var openButton = document.createElement("button");
		openButton.title = "open in dialog editor"; // todo : localize
		openButton.innerHTML = '<i class="material-icons">open_in_new</i>';
		openButton.onclick = function() {
			openDialogTool(dialogId);
		};
		controlDiv.appendChild(openButton);

		var editorDiv = document.createElement("div");
		var scriptEditor;
		function UpdateEditorContent() {
			editorDiv.innerHTML = "";

			if (dialogId != null || (creationOptions && creationOptions.CreateFromEmptyTextBox)) {
				scriptEditor = new PlaintextDialogScriptEditor(dialogId, "miniDialogPlaintextArea");
				editorDiv.appendChild(scriptEditor.GetElement());			
			}
			else if (creationOptions.Presets) {
				console.log(creationOptions.Presets);
				for (var i = 0; i < creationOptions.Presets.length; i++) {
					var preset = creationOptions.Presets[i];
					var scriptStr = preset.Script;
					var presetButton = document.createElement("button");
					presetButton.style.flexGrow = 1; // TODO : style?
					presetButton.innerHTML = '<i class="material-icons">add</i>' + preset.Name;
					presetButton.onclick = function() {
						dialogId = nextAvailableDialogId();
						dialog[dialogId] = scriptStr;
						events.Raise("new_dialog", {id:dialogId});
						// TODO replace OnCreateNewDialog with OnCHange!!!!
						if (creationOptions.OnCreateNewDialog) {
							creationOptions.OnCreateNewDialog(dialogId);
						}
						UpdateEditorContent();
					};
					editorDiv.appendChild(presetButton);
				}
			}
		}
		UpdateEditorContent();
		editorDiv.style.display = "flex";
		div.appendChild(editorDiv);

		var dialogIdSelect = document.createElement("select");
		dialogIdSelect.style.display = "none";
		dialogIdSelect.onchange = function(e) {
			dialogId = e.target.value === "none" ? null : e.target.value;		
			UpdateEditorContent();
			if (onChange != null) {
				onChange(dialogId);
			}
			refreshGameData();
		}
		div.appendChild(dialogIdSelect);

		function UpdateDialogIdSelectOptions() {
			dialogIdSelect.innerHTML = "";	
			var dialogIdList = sortedDialogIdList();
			if (allowNone) {
				var dialogNoneOption = document.createElement("option");
				dialogNoneOption.innerText = "none";
				dialogNoneOption.value = "none";
				dialogNoneOption.selected = dialogId === null;
				dialogIdSelect.appendChild(dialogNoneOption);
			}
			for (var i = 0; i < dialogIdList.length; i++) {
				var dialogIdOption = document.createElement("option");
				dialogIdOption.innerText = "dialog " + dialogIdList[i];
				dialogIdOption.value = dialogIdList[i];
				dialogIdOption.selected = dialogId === dialogIdList[i];
				dialogIdSelect.appendChild(dialogIdOption);
			}
		}
		UpdateDialogIdSelectOptions();
		events.Listen("new_dialog", function() { UpdateDialogIdSelectOptions(); });
		events.Listen("dialog_update", function(event) {
			if (scriptEditor != null && event.editorId == scriptEditor.GetEditorId()) {
				if (dialogId != event.dialogId) {
					dialogId = event.dialogId;
					if (creationOptions.OnCreateNewDialog) {
						creationOptions.OnCreateNewDialog(dialogId);
					}
				}
			}
		})

		settingsButton.onclick = function() {
			showSettings = !showSettings;
			settingsButton.innerHTML = '<i class="material-icons">' + (showSettings ? "text_fields" : "settings") + '</i>';
			editorDiv.style.display = showSettings ? "none" : "flex";
			dialogIdSelect.style.display = showSettings ? "flex" : "none";
		}

		this.GetElement = function() {
			return div;
		}
	}

	var dialogScriptEditorUniqueIdCounter = 0;

	function PlaintextDialogScriptEditor(dialogId, style) {
		var editorId = dialogScriptEditorUniqueIdCounter;
		dialogScriptEditorUniqueIdCounter++;

		var scriptRootNode, div;
		div = document.createElement("div");

		var self = this;

		function RefreshEditorUI() {
			var dialogStr = dialogId === null ? "" : dialog[dialogId];

			div.innerHTML = "";
			scriptRootNode = scriptInterpreter.Parse(dialogStr, dialogId);

			var codeTextArea = document.createElement("textarea");
			codeTextArea.rows = 2;
			codeTextArea.cols = 32;
			codeTextArea.classList.add(style);
			codeTextArea.value = scriptRootNode.Serialize();
			codeTextArea.onchange = function() {
				var dialogStr = '"""\n' + codeTextArea.value + '\n"""'; // single lines?
				scriptRootNode = scriptInterpreter.Parse(dialogStr, dialogId);
				OnUpdate();
			}
			div.appendChild(codeTextArea);
		}

		RefreshEditorUI();

		this.GetElement = function() {
			return div;
		}

		this.GetNode = function() {
			return scriptRootNode;
		}

		function OnUpdate() {
			var dialogStr = scriptRootNode.Serialize();

			var didMakeNewDialog = false;
			if (dialogStr.length > 0 && dialogId === null) {
				dialogId = nextAvailableDialogId();
				didMakeNewDialog = true;
			}

			if (dialogId === null) {
				return;
			}

			if (dialogStr.indexOf("\n") > -1) {
				// hacky - expose the triple-quotes symbol somewhere?
				dialogStr = '"""\n' + dialogStr + '\n"""';
			}

			dialog[dialogId] = dialogStr;

			refreshGameData();

			events.Raise("dialog_update", { dialogId:dialogId, editorId:editorId });
			if (didMakeNewDialog) {
				events.Raise("new_dialog", {id:dialogId});
			}
		}

		events.Listen("dialog_update", function(event) {
			if (dialogId != null && event.dialogId === dialogId && event.editorId != editorId) {
				RefreshEditorUI();
			}
		});

		this.GetEditorId = function() {
			return editorId;
		}
	}

	function DialogScriptEditor(dialogId) {
		var editorId = dialogScriptEditorUniqueIdCounter;
		dialogScriptEditorUniqueIdCounter++;

		var scriptRootNode, div, rootEditor;
		div = document.createElement("div");

		var self = this;
		function RefreshEditorUI() {
			var dialogStr = dialog[dialogId];

			div.innerHTML = "";
			scriptRootNode = scriptInterpreter.Parse(dialogStr, dialogId);
			rootEditor = new BlockEditor(scriptRootNode, self);

			var viewportDiv = document.createElement("div");
			viewportDiv.classList.add("dialogContentViewport");
			// always selected so we can add actions to the root
			viewportDiv.classList.add("selectedEditor");

			viewportDiv.appendChild(rootEditor.GetElement());
			div.appendChild(viewportDiv);
		}

		RefreshEditorUI();

		this.GetElement = function() {
			return div;
		}

		this.GetNode = function() {
			return scriptRootNode;
		}

		function OnUpdate() {
			// scriptInterpreter.DebugVisualizeScriptTree(scriptRootNode);

			var dialogStr = rootEditor.Serialize();

			if (dialogStr.indexOf("\n") > -1) {
				// hacky - expose the triple-quotes symbol somewhere?
				dialogStr = '"""\n' + dialogStr + '\n"""';
			}

			dialog[dialogId] = dialogStr;

			refreshGameData();

			events.Raise("dialog_update", { dialogId:dialogId, editorId:editorId });
		}

		this.NotifyUpdate = function() {
			OnUpdate();
		}

		events.Listen("dialog_update", function(event) {
			if (event.dialogId === dialogId && event.editorId != editorId) {
				RefreshEditorUI();
			}
		});

		/* root level creation functions for the dialog editor top-bar UI */
		this.AddDialog = function() {
			var printFunc = scriptUtils.CreateEmptyPrintFunc();
			rootEditor.GetNodes()[0].AddChild(printFunc); // hacky -- see note in action builder
			var editor = new DialogEditor([printFunc], rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddSequence = function() {
			var node = scriptUtils.CreateSequenceBlock();
			var editor = new SequenceEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddCycle = function() {
			var node = scriptUtils.CreateCycleBlock();
			var editor = new SequenceEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddShuffle = function() {
			var node = scriptUtils.CreateShuffleBlock();
			var editor = new SequenceEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddConditional = function() {
			var node = scriptUtils.CreateIfBlock();
			var editor = new ConditionalEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}
	}

	function BlockEditor(blockNode, parentEditor) {
		var self = this;

		var div = document.createElement("div");
		div.classList.add("blockEditor");

		var childEditorRootDiv = document.createElement("div");
		div.appendChild(childEditorRootDiv);

		var actionBuilder = new ActionBuilder(this);
		div.appendChild(actionBuilder.GetElement());

		this.GetElement = function() {
			return div;
		}

		this.NotifyUpdate = function(hasNewChildren) {
			if (hasNewChildren) {
				UpdateNodeChildren();
			}

			parentEditor.NotifyUpdate();
		}

		var childEditors = [];
		function CreateChildEditors() {
			// build the editors
			childEditors = [];

			function isCodeBlock(node) { return node.type === "code_block"; };
			function isChildType(node,type) { return node.children[0].type === type; };
			function isIf(node) { return isCodeBlock(node) && isChildType(node,"if") && !node.children[0].IsSingleLine(); };
			function isSeq(node) { return isCodeBlock(node) && (isChildType(node,"sequence") || isChildType(node,"cycle") || isChildType(node,"shuffle")); };

			function isDescribedFunction(node) {
				return isCodeBlock(node) && isChildType(node, "function") && functionDescriptionMap[node.children[0].name] != undefined;
			}

			var dialogNodeList = [];
			function addText() {
				if (dialogNodeList.length > 0) {
					var editor = new DialogEditor(dialogNodeList, self);
					childEditors.push(editor);

					dialogNodeList = [];
				}
			}

			for (var i = 0; i < blockNode.children.length; i++) {
				var node = blockNode.children[i];
				if (isIf(node)) {
					addText();

					var editor = new ConditionalEditor(node, self);
					childEditors.push(editor);
				}
				else if (isSeq(node)) {
					addText();

					var editor = new SequenceEditor(node, self);
					childEditors.push(editor);
				}
				else if (isDescribedFunction(node)) {
					addText();

					var editor = new FunctionEditor(node, self);
					childEditors.push(editor);
				}
				else {
					dialogNodeList.push(node);
				}
			}

			addText();
		}

		function RefreshChildUI() {
			childEditorRootDiv.innerHTML = "";

			for (var i = 0; i < childEditors.length; i++) {
				var editor = childEditors[i];
				childEditorRootDiv.appendChild(editor.GetElement());

				if (i < childEditors.length - 1) {
					var svgArrow = document.createElement("div");
					svgArrow.style.textAlign = "center";
					// svgArrow.style.padding = "0px";
					svgArrow.innerHTML = 
						'<svg width="10" height="10">' +
						'<polygon points="0, 0, 10, 0, 5, 10" fill="#6767b2" />' +
						'</svg>';
					childEditorRootDiv.appendChild(svgArrow);
				}
			}
		}

		function UpdateNodeChildren() {
			var updatedChildren = [];

			for (var i = 0; i < childEditors.length; i++) {
				var editor = childEditors[i];
				updatedChildren = updatedChildren.concat(editor.GetNodes());
			}

			blockNode.SetChildren(updatedChildren);
		}

		this.GetNodes = function() {
			return [blockNode];
		}

		this.Serialize = function() {
			return blockNode.Serialize();
		}

		this.RemoveChild = function(childEditor) {
			childEditors.splice(childEditors.indexOf(childEditor),1);
			RefreshChildUI();

			UpdateNodeChildren();

			parentEditor.NotifyUpdate();
		}

		this.IndexOfChild = function(childEditor) {
			return childEditors.indexOf(childEditor);
		}

		this.InsertChild = function(childEditor, index) {
			childEditors.splice(index, 0, childEditor);
			RefreshChildUI();

			UpdateNodeChildren();

			parentEditor.NotifyUpdate();
		}

		this.AppendChild = function(childEditor) {
			self.InsertChild(childEditor, childEditors.length);
		}

		CreateChildEditors();
		RefreshChildUI();
	}

	function ActionBuilder(parentEditor) {
		var div = document.createElement("div");
		div.classList.add("actionBuilder");

		var addButton = document.createElement("button");
		addButton.classList.add("actionBuilderAdd");
		addButton.innerHTML = '<i class="material-icons">add</i>' + " add";
		addButton.onclick = function() {
			div.classList.add("actionBuilderActive");
			div.classList.add("actionBuilderRoot");
		}
		div.appendChild(addButton);

		var backButton = document.createElement("button");
		backButton.classList.add("actionBuilderButton");
		backButton.classList.add("actionBuilderButton_back");
		backButton.innerHTML = '<i class="material-icons">arrow_back_ios</i>' + "back";
		backButton.onclick = function() {
			div.classList.add("actionBuilderRoot");
			div.classList.remove(activeCategoryClass);
			activeCategoryClass = null;
		}
		div.appendChild(backButton);

		var activeCategoryClass = null;
		function makeActionCategoryButton(categoryName, text) {
			var actionCategoryButton = document.createElement("button");
			actionCategoryButton.classList.add("actionBuilderButton");
			actionCategoryButton.classList.add("actionBuilderCategory");
			actionCategoryButton.innerHTML = text + '<i class="material-icons">arrow_forward_ios</i>';
			actionCategoryButton.onclick = function() {
				div.classList.remove("actionBuilderRoot");
				activeCategoryClass = "actionBuilder_" + categoryName;
				div.classList.add(activeCategoryClass);
			}
			return actionCategoryButton;
		}

		div.appendChild(makeActionCategoryButton("dialog", "dialog actions"));
		div.appendChild(makeActionCategoryButton("flow", "flow control actions"));
		div.appendChild(makeActionCategoryButton("exit", "exit and ending actions"));
		div.appendChild(makeActionCategoryButton("item", "item actions"));

		function makeActionBuilderButton(categoryName, text, createEditorFunc) {
			var actionBuilderButton = document.createElement("button");
			actionBuilderButton.classList.add("actionBuilderButton");
			actionBuilderButton.classList.add("actionBuilderButton_" + categoryName);
			actionBuilderButton.innerHTML = '<i class="material-icons">add</i>' + " " + text;
			actionBuilderButton.onclick = function() {
				var editor = createEditorFunc();
				parentEditor.AppendChild(editor);
				div.classList.remove("actionBuilderActive");
				div.classList.remove(activeCategoryClass);
				activeCategoryClass = null;
			}
			return actionBuilderButton;
		}

		div.appendChild(
			makeActionBuilderButton(
				"dialog",
				"dialog",
				function() {
					var printFunc = scriptUtils.CreateEmptyPrintFunc();

					// hacky access of the parent node is required
					// because the print function needs to start with a parent
					// otherwise the dialog editor can't serialize the text D:
					parentEditor.GetNodes()[0].AddChild(printFunc);

					var editor = new DialogEditor([printFunc], parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				"sequence",
				function() {
					var node = scriptUtils.CreateSequenceBlock();
					var editor = new SequenceEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				"cycle",
				function() {
					var node = scriptUtils.CreateCycleBlock();
					var editor = new SequenceEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				"shuffle",
				function() {
					var node = scriptUtils.CreateShuffleBlock();
					var editor = new SequenceEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				"conditional",
				function() {
					var node = scriptUtils.CreateIfBlock();
					var editor = new ConditionalEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"exit",
				"lock",
				function() {
					var node = scriptUtils.CreateFunctionBlock("lock", []);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"exit",
				"end",
				function() {
					var node = scriptUtils.CreateFunctionBlock("end", []);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		// div.appendChild(
		// 	makeActionBuilderButton(
		// 		"narrate",
		// 		function() {
		// 			var node = scriptUtils.CreateFunctionBlock("narrate");
		// 			var editor = new FunctionEditor(node, parentEditor);
		// 			return editor;
		// 		}));

		div.appendChild(
			makeActionBuilderButton(
				"exit",
				"exit",
				function() {
					var node = scriptUtils.CreateFunctionBlock("exit", ["0", 0, 0]);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				"give item",
				function() {
					var node = scriptUtils.CreateFunctionBlock("giveItem", ["0", 1]);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				"take item",
				function() {
					var node = scriptUtils.CreateFunctionBlock("takeItem", ["0", 1]);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		var cancelButton = document.createElement("button");
		cancelButton.classList.add("actionBuilderButton");
		cancelButton.classList.add("actionBuilderCancel");
		cancelButton.innerHTML = '<i class="material-icons">cancel</i>' + " cancel";
		cancelButton.onclick = function() {
			div.classList.remove("actionBuilderActive");
			div.classList.remove("actionBuilderRoot");
			if (activeCategoryClass != null) {
				div.classList.remove(activeCategoryClass);
				activeCategoryClass = null;
			}
		}
		div.appendChild(cancelButton);

		this.GetElement = function() {
			return div;
		}
	}

	// TODO : this name is confusing to me
	function DialogEditor(dialogNodeList, parentEditor) {
		var div = document.createElement("div");
		div.classList.add("dialogEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		// var span = document.createElement("div");
		// span.innerText = "dialog";
		// div.appendChild(span);

		function OnDialogTextChange() {
			// hacky :(
			var scriptStr = '"""\n' +  textArea.value + '\n"""';
			var tempDialogNode = scriptInterpreter.Parse(scriptStr);
			dialogNodeList = tempDialogNode.children;
			parentEditor.NotifyUpdate(true);
		}
		var textSelectionChangeHandler = createOnTextSelectionChange(OnDialogTextChange);

		var textHolderDiv = document.createElement("div");
		var textArea = document.createElement("textarea");
		textArea.value = scriptUtils.SerializeDialogNodeList(dialogNodeList);
		textArea.onchange = OnDialogTextChange;
		textArea.rows = 2;
		textArea.cols = 32;
		// test: style to center text area
		// textArea.style.margin = "auto";
		// textArea.style.display = "block"; // TODO : move to style file
		textArea.addEventListener('click', textSelectionChangeHandler);
		textArea.addEventListener('select', textSelectionChangeHandler);
		textArea.addEventListener('blur', textSelectionChangeHandler);
		textHolderDiv.appendChild(textArea);
		// textHolderDiv.style.background = "black"; // TODO : does this look better?
		div.appendChild(textHolderDiv);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(this);

		this.GetNodes = function() {
			return dialogNodeList;
		}

		events.Listen("script_node_enter", function(event) {
			if (event.id != undefined) {
				var enterIndex = dialogNodeList.findIndex(function(node) { return node.GetId() === event.id });
				if (enterIndex == 0) {
					div.classList.add("executing");
				}
			}
		});

		events.Listen("script_node_exit", function(event) {
			if (event.id != undefined) {
				var exitIndex = dialogNodeList.findIndex(function(node) { return node.GetId() === event.id });
				if (exitIndex >= dialogNodeList.length-1) {
					div.classList.remove("executing");
					div.classList.remove("executingLeave");
					void div.offsetWidth; // hack to force reflow to allow animation to restart
					div.classList.add("executingLeave");
				}				
			}
		});
	}

	var sequenceTypeDescriptionMap = {
		"sequence" : "do items once in _:",
		"cycle" : "repeat items in a _:",
		"shuffle" : "_ items in a random order:",
	};

	function SequenceEditor(node, parentEditor) {
		var self = this;

		// this hack is terrible
		var sequenceNode = node.children[0];

		var div = document.createElement("div");
		div.classList.add("sequenceEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		var descriptionDiv = document.createElement("div");
		descriptionDiv.classList.add("sequenceDescription");
		div.appendChild(descriptionDiv);

		function CreateSequenceDescription(isEditable) {
			descriptionDiv.innerHTML = "";

			var descriptionText = sequenceTypeDescriptionMap[sequenceNode.type];
			var descriptionTextSplit = descriptionText.split("_");

			var descSpan1 = document.createElement("span");
			descSpan1.innerText = descriptionTextSplit[0];
			descriptionDiv.appendChild(descSpan1);

			if (isEditable) {
				var sequenceTypeSelect = document.createElement("select");
				for (var type in sequenceTypeDescriptionMap) {
					var sequenceTypeOption = document.createElement("option");
					sequenceTypeOption.value = type;
					sequenceTypeOption.innerText = type;
					sequenceTypeOption.selected = (type === sequenceNode.type);
					sequenceTypeSelect.appendChild(sequenceTypeOption);
				}
				sequenceTypeSelect.onchange = function() {
					sequenceNode = scriptUtils.ChangeSequenceType(sequenceNode, sequenceTypeSelect.value);
					node.SetChildren([sequenceNode]);
					CreateSequenceDescription(true);
					parentEditor.NotifyUpdate();
				}
				descriptionDiv.appendChild(sequenceTypeSelect);
			}
			else {
				var sequenceTypeSpan = document.createElement("span");
				sequenceTypeSpan.classList.add("parameterUneditable");
				sequenceTypeSpan.innerText = sequenceNode.type;
				descriptionDiv.appendChild(sequenceTypeSpan);
			}

			var descSpan2 = document.createElement("span");
			descSpan2.innerText = descriptionTextSplit[1];
			descriptionDiv.appendChild(descSpan2);
		}

		CreateSequenceDescription(false);

		var optionRootDiv = document.createElement("div");
		optionRootDiv.classList.add("optionRoot");
		div.appendChild(optionRootDiv);

		var addOptionRootDiv = document.createElement("div");
		addOptionRootDiv.classList.add("addOption");
		div.appendChild(addOptionRootDiv);

		var addOptionButton = document.createElement("button");
		addOptionButton.innerHTML = '<i class="material-icons">add</i>' + "add option";
		addOptionButton.onclick = function() {
			var optionNode = scriptUtils.CreateOptionBlock();
			var optionEditor = new SequenceOptionEditor(optionNode, self);
			optionEditors.push(optionEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}
		addOptionRootDiv.appendChild(addOptionButton);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(
			this,
			function() { CreateSequenceDescription(true); }, /*onSelect*/
			function() { CreateSequenceDescription(false); } /*onDeselect*/ );

		this.GetNodes = function() {
			return [node];
		}

		this.NotifyUpdate = function() {
			parentEditor.NotifyUpdate();
		}

		this.RemoveChild = function(childEditor) {
			optionEditors.splice(optionEditors.indexOf(childEditor),1);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.IndexOfChild = function(childEditor) {
			return optionEditors.indexOf(childEditor);
		}

		this.InsertChild = function(childEditor, index) {
			optionEditors.splice(index, 0, childEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		var optionEditors = [];
		function CreateOptionEditors() {
			optionEditors = [];

			for (var i = 0; i < sequenceNode.children.length; i++) {
				var optionNode = sequenceNode.children[i];
				var optionEditor = new SequenceOptionEditor(optionNode, self);
				optionEditor.SetOrderNumber(i+1);
				optionRootDiv.appendChild(optionEditor.GetElement());
				optionEditors.push(optionEditor);
			}
		}

		function RefreshOptionsUI() {
			optionRootDiv.innerHTML = "";
			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				editor.SetOrderNumber(i+1);
				optionRootDiv.appendChild(editor.GetElement());
			}
		}

		function UpdateNodeOptions() {
			var updatedOptions = [];

			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				updatedOptions = updatedOptions.concat(editor.GetNodes());
			}

			sequenceNode.SetChildren(updatedOptions);
		}

		CreateOptionEditors();

		events.Listen("script_node_enter", function(event) {
			if (event.id === node.GetId()) {
				div.classList.add("executing");
			}
		});

		events.Listen("script_node_exit", function(event) {
			if (event.id === node.GetId()) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
			}
		});
	}

	function SequenceOptionEditor(optionNode, parentEditor) {
		var div = document.createElement("div");
		div.classList.add("optionEditor");

		var topControlsDiv = document.createElement("div");
		topControlsDiv.classList.add("optionControls");
		div.appendChild(topControlsDiv);

		var orderControls = new OrderControls(this, parentEditor);
		topControlsDiv.appendChild(orderControls.GetElement());

		var orderLabel = document.createElement("span");
		orderLabel.innerText = "#)";
		div.appendChild(orderLabel);

		var blockEditor = new BlockEditor(optionNode, parentEditor);
		div.appendChild(blockEditor.GetElement());

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return [optionNode];
		}

		this.SetOrderNumber = function(num) {
			var numString = "" + num;
			if (localization.GetLanguage() === "ar") { // arabic
				numString = ConvertNumberStringToArabic(numString);
			}
			orderLabel.innerText = numString + ")";
		}
	}

	function ConditionalEditor(node, parentEditor) {
		var self = this;

		var conditionalNode = node.children[0];

		var div = document.createElement("div");
		div.classList.add("conditionalEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		var span = document.createElement("span");
		span.innerText = "conditional";
		div.appendChild(span);

		var optionRootDiv = document.createElement("div");
		optionRootDiv.classList.add("optionRoot");
		div.appendChild(optionRootDiv);

		var addOptionRootDiv = document.createElement("div");
		addOptionRootDiv.classList.add("addOption");
		div.appendChild(addOptionRootDiv);

		var addOptionButton = document.createElement("button");
		addOptionButton.innerHTML = '<i class="material-icons">add</i>' + "add option";
		addOptionButton.onclick = function() {
			var conditionPairNode = scriptUtils.CreateConditionPair();
			var optionEditor = new ConditionalOptionEditor(conditionPairNode, self, optionEditors.length);
			optionEditors.push(optionEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}
		addOptionRootDiv.appendChild(addOptionButton);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(this,
			function() { /* onSelect */
				for (var i = 0; i < optionEditors.length; i++) {
					optionEditors[i].Select();
				}
			},
			function() { /* onDeselect */
				for (var i = 0; i < optionEditors.length; i++) {
					optionEditors[i].Deselect();
				}
			});

		this.GetNodes = function() {
			return [node];
		}

		this.NotifyUpdate = function() {
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.RemoveChild = function(childEditor) {
			optionEditors.splice(optionEditors.indexOf(childEditor),1);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.IndexOfChild = function(childEditor) {
			return optionEditors.indexOf(childEditor);
		}

		this.InsertChild = function(childEditor, index) {
			optionEditors.splice(index, 0, childEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		var optionEditors = [];
		function CreateOptionEditors() {
			optionEditors = [];

			for (var i = 0; i < conditionalNode.children.length; i++) {
				var optionEditor = new ConditionalOptionEditor(conditionalNode.children[i], self, i);
				optionRootDiv.appendChild(optionEditor.GetElement());
				optionEditors.push(optionEditor);
			}
		}

		function RefreshOptionsUI() {
			optionRootDiv.innerHTML = "";
			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				editor.UpdateIndex(i);
				optionRootDiv.appendChild(editor.GetElement());
			}
		}

		// TODO : share w/ sequence editor?
		function UpdateNodeOptions() {
			var updatedOptions = [];

			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				updatedOptions = updatedOptions.concat(editor.GetNodes());
			}

			conditionalNode.SetChildren(updatedOptions);
		}

		CreateOptionEditors();

		events.Listen("script_node_enter", function(event) {
			if (event.id === node.GetId()) {
				div.classList.add("executing");
			}
		});

		events.Listen("script_node_exit", function(event) {
			if (event.id === node.GetId()) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
			}
		});
	}

	function ConditionalOptionEditor(conditionPairNode, parentEditor, index) {
		var div = document.createElement("div");
		div.classList.add("optionEditor");

		var topControlsDiv = document.createElement("div");
		topControlsDiv.classList.add("optionControls");
		div.appendChild(topControlsDiv);

		var orderControls = new OrderControls(this, parentEditor);
		topControlsDiv.appendChild(orderControls.GetElement());

		// condition
		var comparisonEditor = new ConditionalComparisonEditor(conditionPairNode.children[0], this, index);
		div.appendChild(comparisonEditor.GetElement());

		// result
		var resultBlockEditor = new BlockEditor(conditionPairNode.children[1], this);
		div.appendChild(resultBlockEditor.GetElement());

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return [conditionPairNode];
		}

		this.NotifyUpdate = function() {
			var updatedChildren = comparisonEditor.GetNodes().concat(resultBlockEditor.GetNodes());
			conditionPairNode.SetChildren(updatedChildren);

			parentEditor.NotifyUpdate();
		}

		this.UpdateIndex = function(i) {
			index = i;
			comparisonEditor.UpdateIndex(index);
		}

		this.Select = function() {
			comparisonEditor.Select();
		}

		this.Deselect = function() {
			comparisonEditor.Deselect();
		}
	}

	function GetConditionType(condition) {
		if (condition.type === "else") {
			return "else";
		}
		else if (condition.type === "operator") {
			if (condition.right.type === "literal" && !isNaN(condition.right.value)) {
				if (condition.left.type === "code_block") {
					var child = condition.left.children[0];
					if (child.type === "function" && child.name === "item") {
						return "item";
					}
				}
				if (condition.left.type === "variable" && variable[condition.left.name] != null) {
					return "variable";
				}
			}
		}
		return "custom";
	}

	// TODO : use these
	var conditionTypes = ["item","variable","else","custom"];
	// var conditionTypeNames = [
	// 	localization.GetStringOrFallback("item_label", "item"),
	// 	localization.GetStringOrFallback("variable_label", "variable"),
	// 	localization.GetStringOrFallback("condition_type_default", "default"),
	// 	localization.GetStringOrFallback("condition_type_custom", "custom")
	// ];

	// var conditionTypesVerbose = ["the player's inventory of the item", "the value of the variable", "no other condition is met (default)", "a custom condition is met"]
	// var comparisonNames = ["equals","greater than","less than","greater than or equal to","less than or equal to"];
	var comparisonTypes = ["==", ">", "<", ">=", "<="];
	// var comparisonTypesVerbose = ["is equal to", "is greater than", "is less than", "is greater than or equal to", "is less than or equal to"];

	function ConditionalComparisonEditor(conditionNode, parentEditor, index) {
		var conditionType = GetConditionType(conditionNode);

		// init description elements
		var conditionStartSpan;
		var conditionDescriptionSpan;
		var conditionEndSpan;

		// init input elements
		var conditionTypeSelect;
		var itemSelect;
		var variableSelect;
		var comparisonSelect;
		var valueInput;
		var textArea; // for custom input

		function GetItemId() {
			return conditionNode.left.children[0].args[0].value;
		}

		function GetVariableId() {
			return conditionNode.left.name;
		}

		function GetComparisonOperator() {
			return conditionNode.operator;
		}

		function GetRightHandValue() {
			return parseInt(conditionNode.right.value);
		}

		// init value handler - custom is the default
		var valueChangeHandler = null;
		function InitValueChangeHandler() {
			valueChangeHandler = function() {
				conditionNode = scriptInterpreter.CreateExpression(textArea.value);
				parentEditor.NotifyUpdate();
			}
			if (conditionType === "item") {
				valueChangeHandler = function() {
					var expStr = '{item "' + itemSelect.value + '"} ' + comparisonSelect.value + ' ' + valueInput.value;
					conditionNode = scriptInterpreter.CreateExpression(expStr);
					parentEditor.NotifyUpdate();
				}
			}
			else if (conditionType === "variable") {
				valueChangeHandler = function() {
					var expStr = variableSelect.value + ' ' + comparisonSelect.value + ' ' + valueInput.value;
					conditionNode = scriptInterpreter.CreateExpression(expStr);
					parentEditor.NotifyUpdate();
				}
			}
		}
		InitValueChangeHandler();

		var div = document.createElement("div");
		div.classList.add("conditionalComparisonEditor");

		function CreateComparisonControls() {
			div.innerHTML = "";

			conditionStartSpan = document.createElement("span");
			if (conditionType != "else") {
				if (index === 0) {
					conditionStartSpan.innerText = "if ";
				}
				else {
					conditionStartSpan.innerText = "else if ";
				}
			}
			div.appendChild(conditionStartSpan);

			// type select
			conditionTypeSelect = document.createElement("select");
			conditionTypeSelect.title = "choose type of condition to check";
			div.appendChild(conditionTypeSelect);
			for(var i = 0; i < conditionTypes.length; i++) {
				var conditionTypeOption = document.createElement("option");
				conditionTypeOption.value = conditionTypes[i];
				conditionTypeOption.innerText = conditionTypes[i]; // conditionTypeNames[i];
				conditionTypeOption.selected = conditionTypes[i] === conditionType;
				conditionTypeSelect.appendChild(conditionTypeOption);
			}
			conditionTypeSelect.onchange = function() {
				if (conditionTypeSelect.value === "else") {
					conditionNode = scriptUtils.CreateElseNode();
				}
				else if (conditionTypeSelect.value === "item") {
					var expStr = '{item "0"} == 1';
					conditionNode = scriptInterpreter.CreateExpression(expStr);
				}
				else if (conditionTypeSelect.value === "variable") {
					var expStr = 'a == 1';
					conditionNode = scriptInterpreter.CreateExpression(expStr);
				}
				else if (conditionTypeSelect.value === "custom") {
					var expStr = 'a = a + 1';
					conditionNode = scriptInterpreter.CreateExpression(expStr);
				}

				conditionType = GetConditionType(conditionNode);
				InitValueChangeHandler();
				CreateComparisonControls();
				parentEditor.NotifyUpdate();
			}

			if (conditionType === "item") {
				// item select
				itemSelect = document.createElement("select");
				itemSelect.title = "choose item to check";
				div.appendChild(itemSelect);
				for (id in item) {
					var itemOption = document.createElement("option");
					itemOption.value = id;
					itemOption.innerText = GetItemNameFromId(id);
					itemOption.selected = id === GetItemId();
					itemSelect.appendChild(itemOption);
				}
				itemSelect.onchange = valueChangeHandler;
			}
			else if (conditionType === "variable") {
				// variable select
				variableSelect = document.createElement("select");
				variableSelect.title = "choose variable to check";
				div.appendChild(variableSelect);
				for (id in variable) {
					var variableOption = document.createElement("option");
					variableOption.value = id;
					variableOption.innerText = id;
					variableOption.selected = id === GetVariableId();
					variableSelect.appendChild(variableOption);
				}
				variableSelect.onchange = valueChangeHandler;
			}

			if (conditionType === "item" || conditionType === "variable") {
				// comparison select
				comparisonSelect = document.createElement("select");
				comparisonSelect.title = "choose a comparison type";
				div.appendChild(comparisonSelect);
				for (var i = 0; i < comparisonTypes.length; i++) {
					var comparisonOption = document.createElement("option");
					comparisonOption.value = comparisonTypes[i];
					comparisonOption.innerText = comparisonTypes[i];
					comparisonOption.selected = comparisonTypes[i] === GetComparisonOperator();
					comparisonSelect.appendChild(comparisonOption);
				}
				comparisonSelect.onchange = valueChangeHandler;

				// value input
				valueInput = document.createElement("input");
				valueInput.type = "number";
				valueInput.title = "choose number to compare";
				valueInput.value = GetRightHandValue();
				div.appendChild(valueInput);
				valueInput.onchange = valueChangeHandler;
			}

			if (conditionType === "custom") {
				// custom condition input
				textArea = document.createElement("textarea");
				textArea.value = conditionNode.Serialize();
				textArea.onchange = valueChangeHandler;
				div.appendChild(textArea);
			}

			conditionEndSpan = document.createElement("span");
			if (conditionType != "else") {
				conditionEndSpan.innerText = ", then:";
			}
			else {
				conditionEndSpan.innerText = " :";
			}
			div.appendChild(conditionEndSpan);
		}

		function CreateComparisonDescription() {
			div.innerHTML = "";

			conditionStartSpan = document.createElement("span");
			if (conditionType != "else") {
				if (index === 0) {
					conditionStartSpan.innerText = "if ";
				}
				else {
					conditionStartSpan.innerText = "else if ";
				}
			}
			div.appendChild(conditionStartSpan);

			conditionDescriptionSpan = document.createElement("span");
			conditionDescriptionSpan.classList.add("parameterUneditable");
			conditionDescriptionSpan.innerText = "";

			if (conditionType != "custom") {
				conditionDescriptionSpan.innerText += conditionType;
			}

			if (conditionType === "item") {
				conditionDescriptionSpan.innerText += " " + GetItemNameFromId(GetItemId());
			}
			else if (conditionType === "variable") {
				conditionDescriptionSpan.innerText += " " + GetVariableId();
			}

			if (conditionType === "item" || conditionType === "variable") {
				conditionDescriptionSpan.innerText += " " + GetComparisonOperator();
				conditionDescriptionSpan.innerText += " " + GetRightHandValue();
			}
			else if (conditionType === "custom") {
				conditionDescriptionSpan.innerText += conditionNode.Serialize();
			}

			div.appendChild(conditionDescriptionSpan);

			conditionEndSpan = document.createElement("span");
			if (conditionType != "else") {
				conditionEndSpan.innerText = ", then:";
			}
			else {
				conditionEndSpan.innerText = ":";
			}
			div.appendChild(conditionEndSpan);
		}

		CreateComparisonDescription();

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return [conditionNode];
		}

		this.UpdateIndex = function(i) {
			index = i;

			// update the initial label based on the order of the option
			if (conditionType != "else") {
				if (index === 0) {
					conditionStartSpan.innerText = "if ";
				}
				else {
					conditionStartSpan.innerText = "else if ";
				}
			}
		}

		this.Select = function() {
			CreateComparisonControls();
		}

		this.Deselect = function() {
			CreateComparisonDescription();
		}
	}

	var functionDescriptionMap = {
		"lock" : {
			description : "lock event",
			parameters : [],
			helpText : "prevents the default action that happens "
				+ "after this event (changing rooms for exits, "
				+ "stopping the game for endings, picking up items, etc.)",
		},
		"end" : {
			description : "end the game",
			parameters : [],
		},
		"exit" : {
			description : "move player to _",
			parameters : [
				{ type: "roomPos", index: 0 },
			],
		},
		"narrate" : {
			description : "start narration",
			parameters : [],
		},
		"giveItem" : {
			description : "give player _ of _",
			parameters : [
				{ type: "count", index: 1 },
				{ type: "itemId", index: 0 },
			],
		},
		"takeItem" : {
			description : "take _ of _ from player",
			parameters : [
				{ type: "count", index: 1 },
				{ type: "itemId", index: 0 },
			],
		},
	};

	function FunctionEditor(node, parentEditor) {
		var self = this;

		var functionNode = node.children[0];

		var div = document.createElement("div");
		div.classList.add("functionEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		var descriptionDiv = document.createElement("div");
		div.appendChild(descriptionDiv);

		var helpTextDiv = document.createElement("div");
		div.appendChild(helpTextDiv);

		// TODO : populate default values!!
		var curParameterEditors = [];
		function CreateFunctionDescription(isEditable) {
			curParameterEditors = [];
			descriptionDiv.innerHTML = "";

			var descriptionText = functionDescriptionMap[functionNode.name].description;
			var descriptionTextSplit = descriptionText.split("_");

			for (var i = 0; i < descriptionTextSplit.length; i++) {
				var descriptionSpan = document.createElement("span");
				descriptionSpan.innerText = descriptionTextSplit[i];
				descriptionDiv.appendChild(descriptionSpan);

				if (i < descriptionTextSplit.length - 1) {
					var parameterInfo = functionDescriptionMap[functionNode.name].parameters[i];

					var parameterEditor;
					if (parameterEditorMap[parameterInfo.type]) {
						parameterEditor = new parameterEditorMap[parameterInfo.type](functionNode, parameterInfo.index, self, isEditable);
					}
					else {
						parameterEditor = new DefaultParameterEditor(functionNode, parameterInfo.index, self, isEditable);
					}

					curParameterEditors.push(parameterEditor);
					descriptionDiv.appendChild(parameterEditor.GetElement());	
				}
			}

			helpTextDiv.innerText = "";
			helpTextDiv.classList.remove("helpText");
			if (isEditable) {
				var helpText = functionDescriptionMap[functionNode.name].helpText;
				if (helpText != undefined && helpText != null) {
					helpTextDiv.innerText = helpText;
					helpTextDiv.classList.add("helpText");
				}
			}
		}

		CreateFunctionDescription(false);

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return [node];
		}

		this.NotifyUpdate = function() {
			parentEditor.NotifyUpdate();
		}

		AddSelectionBehavior(
			this,
			function() { CreateFunctionDescription(true); }, /*onSelect*/
			function() { /*onDeselect*/
				for (var i = 0; i < curParameterEditors.length; i++) {
					if (curParameterEditors[i].Deselect) {
						curParameterEditors[i].Deselect();
					}
				}

				CreateFunctionDescription(false);
			});

		events.Listen("script_node_enter", function(event) {
			if (event.id === node.GetId()) {
				div.classList.add("executing");
			}
		});

		events.Listen("script_node_exit", function(event) {
			if (event.id === node.GetId()) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
			}
		});
	}

	function DefaultParameterEditor(functionNode, parameterIndex, parentEditor, isEditable) {
		var span = document.createElement("span");

		var value = functionNode.args.length > parameterIndex ? functionNode.args[parameterIndex].Serialize() : "";

		if (isEditable) {
			var parameterInput = document.createElement("input");
			parameterInput.type = "text";
			span.appendChild(parameterInput);

			if (functionNode.args.length > parameterIndex) {
				parameterInput.value = value;
			}

			parameterInput.onchange = function(event) {
				var val = event.target.value;

				var literal = scriptUtils.CreateLiteralNode(val);

				functionNode.args.splice(parameterIndex, 1, literal);

				parentEditor.NotifyUpdate();
			}
		}
		else {
			var parameterValue = document.createElement("span");
			parameterValue.classList.add("parameterUneditable");
			parameterValue.innerText = value;
			span.appendChild(parameterValue);
		}

		this.GetElement = function() {
			return span;
		}
	}

	function CountParameterEditor(functionNode, parameterIndex, parentEditor, isEditable) {
		var span = document.createElement("span");

		var value = functionNode.args.length > parameterIndex ? parseInt(functionNode.args[parameterIndex].Serialize()) : 1;

		if (isEditable) {
			var parameterInput = document.createElement("input");
			parameterInput.type = "number";
			parameterInput.min = 0;
			parameterInput.value = value;
			span.appendChild(parameterInput);

			parameterInput.onchange = function(event) {
				var val = event.target.value;

				var literal = scriptUtils.CreateLiteralNode(val);

				functionNode.args.splice(parameterIndex, 1, literal);

				parentEditor.NotifyUpdate();
			}			
		}
		else {
			var parameterValue = document.createElement("span");
			parameterValue.classList.add("parameterUneditable");
			parameterValue.innerText = value;
			span.appendChild(parameterValue);
		}


		this.GetElement = function() {
			return span;
		}
	}

	function GetItemNameFromId(id) {
		return (item[id].name != null ? item[id].name : localization.GetStringOrFallback("item_label", "item") + " " + id);
	}

	function ItemIdParameterEditor(functionNode, parameterIndex, parentEditor, isEditable) {
		var span = document.createElement("span");

		var curSelectedId = "0";
		if (functionNode.args.length > parameterIndex) {
			// TODO : error checking
			curSelectedId = functionNode.args[parameterIndex].Serialize().slice(1,-1);
		}

		if (isEditable) {
			var itemSelect = document.createElement("select");
			itemSelect.title = "choose item to check";
			span.appendChild(itemSelect);
			for(id in item) {
				var itemOption = document.createElement("option");
				itemOption.value = id;
				itemOption.innerText = GetItemNameFromId(id);
				itemOption.selected = id === curSelectedId;
				itemSelect.appendChild(itemOption);
			}

			itemSelect.onchange = function(event) {
				var val = event.target.value;

				var literal = scriptUtils.CreateStringLiteralNode(val);

				functionNode.args.splice(parameterIndex, 1, literal);

				parentEditor.NotifyUpdate();
			}			
		}
		else {
			var parameterValue = document.createElement("span");
			parameterValue.classList.add("parameterUneditable");
			parameterValue.innerText = GetItemNameFromId(curSelectedId);
			span.appendChild(parameterValue);	
		}


		this.GetElement = function() {
			return span;
		}
	}

	function RoomPosParameterEditor(functionNode, parameterIndex, parentEditor, isEditable) {
		var span = document.createElement("span");
		span.classList.add("roomPosParameterEditor");

		var posLabel = document.createElement("span");
		span.appendChild(posLabel);

		var roomId = "0";
		var roomPosX = 0;
		var roomPosY = 0;

		if (functionNode.args.length > (parameterIndex + 2)) {
			roomId = functionNode.args[parameterIndex + 0].Serialize().slice(1,-1);
			roomPosX = parseInt(functionNode.args[parameterIndex + 1].Serialize());
			roomPosY = parseInt(functionNode.args[parameterIndex + 2].Serialize());
		}

		function UpdatePosLabel() {
			var roomName = room[roomId] != undefined ? room[roomId].name : undefined;
			if (roomName == undefined || roomName == null) {
				roomName = localization.GetStringOrFallback("room_tool_name", "room") + " " + roomId;
			}
			posLabel.innerText = roomName + " (" + roomPosX + "," + roomPosY + ")";
		}
		UpdatePosLabel();

		if (isEditable) {
			var isMoving = false;

			var moveButton = document.createElement("button");
			// moveButton.innerText = "move";
			moveButton.innerHTML = '<i class="material-icons">location_searching</i>';
			moveButton.title = "click to select new room location";
			moveButton.onclick = function() {
				isMoving = !isMoving;

				if (isMoving) {
					posLabel.innerHTML = "<i>click in room</i>";
					moveButton.innerHTML = '<i class="material-icons">cancel</i>';
					events.Raise("disable_room_tool"); // TODO : don't know if I like this design
				}
				else {
					UpdatePosLabel();
					moveButton.innerHTML = '<i class="material-icons">location_searching</i>';
					events.Raise("enable_room_tool");
				}
			}
			span.appendChild(moveButton);

			events.Listen("click_room", function(event) {
				if (isMoving) {
					roomId = event.roomId;
					roomPosX = event.x;
					roomPosY = event.y;

					functionNode.args.splice(parameterIndex + 0, 1, scriptUtils.CreateStringLiteralNode(roomId));
					functionNode.args.splice(parameterIndex + 1, 1, scriptUtils.CreateLiteralNode(roomPosX));
					functionNode.args.splice(parameterIndex + 2, 1, scriptUtils.CreateLiteralNode(roomPosY));

					isMoving = false;
					UpdatePosLabel();
					moveButton.innerHTML = '<i class="material-icons">location_searching</i>';

					parentEditor.NotifyUpdate();

					events.Raise("enable_room_tool");
				}
			});
		}

		this.GetElement = function() {
			return span;
		}

		this.Deselect = function() {
			if (isMoving) {
				isMoving = false;
				UpdatePosLabel();
				moveButton.innerHTML = '<i class="material-icons">location_searching</i>';
				events.Raise("enable_room_tool");
			}
		}
	}

	var parameterEditorMap = {
		"count" : CountParameterEditor,
		"itemId" : ItemIdParameterEditor,
		"roomPos" : RoomPosParameterEditor,
	};

	function OrderControls(editor, parentEditor) {
		var div = document.createElement("div");
		div.classList.add("orderControls");

		var moveUpButton = document.createElement("button");
		// moveUpButton.innerText = "up";
		moveUpButton.innerHTML = '<i class="material-icons">expand_less</i>';
		moveUpButton.onclick = function() {
			var insertIndex = parentEditor.IndexOfChild(editor);
			parentEditor.RemoveChild(editor);
			insertIndex -= 1;
			parentEditor.InsertChild(editor,insertIndex);
		}
		div.appendChild(moveUpButton);

		var moveDownButton = document.createElement("button");
		// moveDownButton.innerText = "down";
		moveDownButton.innerHTML = '<i class="material-icons">expand_more</i>';
		moveDownButton.onclick = function() {
			var insertIndex = parentEditor.IndexOfChild(editor);
			parentEditor.RemoveChild(editor);
			insertIndex += 1;
			parentEditor.InsertChild(editor,insertIndex);
		}
		div.appendChild(moveDownButton);

		var deleteButton = document.createElement("button");
		// deleteButton.innerText = "delete";
		deleteButton.innerHTML = '<i class="material-icons">clear</i>';
		deleteButton.style.float = "right";
		deleteButton.onclick = function() {
			parentEditor.RemoveChild(editor);
		}
		div.appendChild(deleteButton);

		this.GetElement = function() {
			return div;
		}
	}

	var curSelectedEditor = null;
	function AddSelectionBehavior(editor, onSelect, onDeselect) {
		editor.Select = function() {
			editor.GetElement().classList.add("selectedEditor");
			if (onSelect) {
				onSelect();
			}
		}

		editor.Deselect = function() {
			editor.GetElement().classList.remove("selectedEditor");
			if (onDeselect) {
				onDeselect();
			}
		}

		editor.GetElement().onclick = function(event) {
			event.stopPropagation();

			if (curSelectedEditor === editor) {
				return; // already selected!
			}

			if (curSelectedEditor != null) {
				curSelectedEditor.Deselect();
			}

			editor.Select();
			curSelectedEditor = editor;
		}
	}
}

/* OLD UN-WRAPPED FUNCTIONS */
function addDialogBlockUI() {
	if (curDialogEditor != null) {
		curDialogEditor.AddDialog();
	}
}

function addSeqBlockUI() {
	if (curDialogEditor != null) {
		curDialogEditor.AddSequence();
	}
}

function addCycleBlock() {
	if (curDialogEditor != null) {
		curDialogEditor.AddCycle();
	}
}

function addShuffleBlock() {
	if (curDialogEditor != null) {
		curDialogEditor.AddShuffle();
	}
}

function addIfBlockUI() {
	if (curDialogEditor != null) {
		curDialogEditor.AddConditional();
	}
}

function ConvertNumberStringToArabic(numberString) {
	var arabicNumerals = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];

	var arabicNumberString = "";

	for (var i = 0; i < numberString.length; i++)
	{
		arabicNumberString += arabicNumerals[parseInt(numberString[i])];
	}

	return arabicNumberString;
}

// TODO : what is this used for?
function createIconElement(iconName) {
	var icon = document.createElement("i");
	icon.classList.add('material-icons');
	icon.innerText = iconName;
	return icon;
}

var dialogSel = {
	target : null,
	start : 0,
	end : 0,
	onchange : null
}

function createOnTextSelectionChange(onchange) {
	return function(event) {
		dialogSel.target = event.target;
		dialogSel.start = event.target.selectionStart;
		dialogSel.end = event.target.selectionEnd;
		dialogSel.onchange = onchange;

		var effectButtons = document.getElementsByClassName("dialogEffectButton");
		for(var i = 0; i < effectButtons.length; i++) {
			effectButtons[i].disabled = false;
		}
	}
}

function preventTextDeselect(event) {
	if(dialogSel.target != null) {
		// event.preventDefault();
	}
}

function preventTextDeselectAndClick(event) {
	if(dialogSel.target != null) {
		// event.preventDefault();
		event.target.click();
	}
}

function wrapTextSelection(effect) {
	if( dialogSel.target != null ) {
		var curText = dialogSel.target.value;
		var selText = curText.slice(dialogSel.start, dialogSel.end);

		var isEffectAlreadyApplied = selText.indexOf( effect ) > -1;
		if(isEffectAlreadyApplied) {
			//remove all instances of effect
			var effectlessText = selText.split( effect ).join( "" );
			var newText = curText.slice(0, dialogSel.start) + effectlessText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectlessText.length);
			if(dialogSel.onchange != null)
				dialogSel.onchange( dialogSel ); // dialogSel needs to mimic the event the onchange would usually receive
		}
		else {
			// add effect
			var effectText = effect + selText + effect;
			var newText = curText.slice(0, dialogSel.start) + effectText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectText.length);
			if(dialogSel.onchange != null)
				dialogSel.onchange( dialogSel ); // dialogSel needs to mimic the event the onchange would usually receive
		}
	}
}