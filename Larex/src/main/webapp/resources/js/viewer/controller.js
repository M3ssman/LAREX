function Controller(bookID, canvasID, specifiedColors, colors, globalSettings) {
	let _bookID = bookID;
	const _actionController = new ActionController(this);
	const _communicator = new Communicator();
	let _globalSettings = globalSettings;
	let _gui;
	let _guiInput;
	let _editor;
	let _currentPage;
	let _segmentedPages = [];
	let _savedPages = [];
	let _book;
	let _segmentation;
	let _settings;
	let _activesettings;
	let _segmentationtypes;
	let _presentRegions = [];
	let _exportSettings = {};
	let _currentPageDownloadable = false;
	let	_currentSettingsDownloadable = false;
	let _pageXMLVersion = "2010-03-19";
	let _gridIsActive = false;
	let _displayReadingOrder = false;
	let _tempReadingOrder = null;
	let _allowLoadLocal = false;
	let _selected = [];
	this.selectmultiple = false;
	let _isSelecting = false;
	let _selectType;
	let _visibleRegions = {}; // !_visibleRegions.contains(x) and _visibleRegions[x] == false => x is hidden

	let _editReadingOrder = false;

	let _newPathCounter = 0;
	let _specifiedColors = specifiedColors;
	let _colors = colors;

	// main method
	$(window).ready(() => {
				// Init PaperJS
				paper.setup(document.getElementById(canvasID));

				//set height before data is loaded //TODO rework
				$canvas = $("canvas");
				$sidebars = $('.sidebar');
				const height = $(window).height() - $canvas.offset().top;
				$canvas.height(height);
				$sidebars.height(height);

				_currentPage = 0;
				this.showPreloader(true);
				_communicator.loadBook(_bookID,_currentPage).done((data) => {
							_book = data.book;
							_segmentation = data.segmentation;
							_segmentationtypes = data.segmenttypes;
							_settings = data.settings;
							// clone _settings
							_activesettings = JSON.parse(JSON.stringify(_settings));
							_segmentedPages.push(_currentPage);

							// Init the viewer
							const navigationController = new NavigationController();
							const viewerInput = new ViewerInput(this);

							// Inheritance Editor extends Viewer
							_editor = new Editor(_segmentationtypes, viewerInput,colors,specifiedColors,this);

							_gui = new GUI(canvasID, _editor);
							_gui.resizeViewerHeight();

							_gui.setParameters(_settings.parameters,_settings.imageSegType,_settings.combine);
							_gui.setRegionLegendColors(_segmentationtypes);
							_gui.highlightSegmentedPages(_segmentedPages);

							_gui.setPageXMLVersion(_pageXMLVersion);

							_gui.setAllRegionColors(colors);
							_gui.updateAvailableColors(this.getAvailableColorIndexes());

							navigationController.setGUI(_gui);
							navigationController.setViewer(_editor);
							// setup paper again because of pre-resize bug
							// (streched)
							paper.setup(document.getElementById(canvasID));


							// Init inputs
							const keyInput = new KeyInput(navigationController,
									this, _gui);
							$("#"+canvasID).mouseover(() => keyInput.isActive = true);
							$("#"+canvasID).mouseleave(() => keyInput.isActive = false);
							_guiInput = new GuiInput(navigationController, this, _gui);

							this.showPreloader(false);
							this.displayPage(0);

							// on resize
							$(window).resize(() => _gui.resizeViewerHeight());
						});

			});

	this.displayPage = function(pageNr) {
		_currentPage = pageNr;

		this.showPreloader(true);

		if (_segmentedPages.indexOf(_currentPage) < 0 && _savedPages.indexOf(_currentPage) < 0) {
				this._requestSegmentation(_currentPage,_allowLoadLocal);
		}else{
				const imageId = _book.pages[_currentPage].id+"image";
				// Check if image is loadedreadingOrder
				const image = $('#'+imageId);
				if(!image[0]){
					_communicator.loadImage(_book.pages[_currentPage].image,imageId).done(() => this.displayPage(pageNr));
					return false;
				}
				if(!image[0].complete){
					// break until image is loaded
					image.load(() => this.displayPage(pageNr));
					return false;
				}

				_editor.clear();
				_editor.setImage(imageId);
				const pageSegments = _segmentation[_currentPage].segments;
				const pageFixedSegments = _settings.pages[_currentPage].segments;

				let readingOrderIsEmpty = false;
				if(!_exportSettings[_currentPage]){
					this._initExportSettings(_currentPage);
				}

				// Iterate over Segment-"Map" (Object in JS)
				Object.keys(pageSegments).forEach((key) => {
					let hasFixedSegmentCounterpart = false;
					if(!pageFixedSegments[key] && !(_exportSettings[_currentPage] && $.inArray(key,_exportSettings[_currentPage].segmentsToIgnore) >= 0)){
						//has no fixedSegment counterpart and has not been deleted
						_editor.addSegment(pageSegments[key]);
					}
				});
				// Iterate over FixedSegment-"Map" (Object in JS)
				Object.keys(pageFixedSegments).forEach((key) => _editor.addSegment(pageFixedSegments[key],true));

				const regions = _settings.regions;
				// Iterate over Regions-"Map" (Object in JS)
				Object.keys(regions).forEach((key) => {
					const region = regions[key];

					// Iterate over all Polygons in Region
					Object.keys(region.polygons).forEach((polygonKey) => {
						let polygon = region.polygons[polygonKey];
						_editor.addRegion(polygon);

						if(!_visibleRegions[region.type] & region.type !== 'ignore'){
							_editor.hideSegment(polygon.id,true);
						}
					});

					if(region.type !== 'ignore' && $.inArray(region.type, _presentRegions) < 0){
						//_presentRegions does not contains region.type
						_presentRegions.push(region.type);
					}
				});

				const pageCuts = _settings.pages[_currentPage].cuts;
				// Iterate over FixedSegment-"Map" (Object in JS)
				Object.keys(pageCuts).forEach((key) => _editor.addLine(pageCuts[key]));
				_editor.center();
				_editor.zoomFit();

				_gui.updateZoom();
				_gui.showUsedRegionLegends(_presentRegions);
				_gui.setReadingOrder(_exportSettings[_currentPage].readingOrder);
				_guiInput.addDynamicListeners();
				this.displayReadingOrder(_displayReadingOrder);
				_gui.setRegionLegendColors(_segmentationtypes);

				this.setPageDownloadable(_currentPage,false);
				_gui.selectPage(pageNr);
				_tempReadingOrder = null;
				this.endCreateReadingOrder();
				this.showPreloader(false);
		}
	}

	this.redo = function() {
		_actionController.redo(_currentPage);
	}
	this.undo = function() {
		_actionController.undo(_currentPage);
	}

	this.addPresentRegions = function(regionType){
		if(region.type !== 'ignore' && $.inArray(regionType, _presentRegions) < 0){
			//_presentRegions does not contains region.type
			_presentRegions.push(regionType);
		}
		_gui.showUsedRegionLegends(_presentRegions);
	}
	this.removePresentRegions = function(regionType){
		_presentRegions = jQuery.grep(_presentRegions, (value) => value != regionType);
		_gui.showUsedRegionLegends(_presentRegions);
	}

	// New Segmentation with different Settings
	this.doSegmentation = function(pageID){
		_settings.parameters = _gui.getParameters();

		// clone _settings
		_activesettings = JSON.parse(JSON.stringify(_settings));
		_segmentedPages = _savedPages.slice(0); //clone saved Pages

		this._requestSegmentation(pageID,false);
	}

	this.loadExistingSegmentation = function(){
		_settings.parameters = _gui.getParameters();

		// clone _settings
		_activesettings = JSON.parse(JSON.stringify(_settings));
		_segmentedPages = _savedPages.slice(0); //clone saved Pages

		this._requestSegmentation(_currentPage,true);
	}
	
	this.uploadExistingSegmentation = function(file){
		_segmentedPages = _savedPages.slice(0); //clone saved Pages
		this._uploadSegmentation(file,_currentPage);
	}

	this._requestSegmentation = function(pageID, allowLoadLocal){
		if(!pageID){
				pageID = _currentPage;
		}

		_communicator.segmentBook(_activesettings,pageID,allowLoadLocal).done((result) => {
				const failedSegmentations = [];
				const missingRegions = [];
				// reset export Settings
				this._initExportSettings(pageID);
				switch (result.status) {
					case 'SUCCESS':
						_segmentation[pageID] = result;

						_actionController.resetActions(pageID);
						//check if all necessary regions are available
						Object.keys(result.segments).forEach((segmentID) => {
							let segment = result.segments[segmentID];
							if($.inArray(segment.type,_presentRegions) == -1){
								//TODO as Action
								this.changeRegionSettings(segment.type,0,0);	
								missingRegions.push(segment.type);
							}
						});
						let readingOrder = [];
						result.readingOrder.forEach((segmentID) => readingOrder.push(result.segments[segmentID]));
						_actionController.addAndExecuteAction(new ActionChangeReadingOrder(_exportSettings[pageID].readingOrder,readingOrder,this,_exportSettings,pageID),pageID);
						break;
					default:
						failedSegmentations.push(pageID);
				}
					
				_segmentedPages.push(pageID);
				if(missingRegions.length > 0){
					_gui.displayWarning('Warning: Some regions were missing and have been added.');
				}

				this.displayPage(pageID);
				_gui.highlightSegmentedPages(_segmentedPages);
				_gui.highlightPagesAsError(failedSegmentations);
		});
	}

	this._uploadSegmentation = function(file,pageNr){
		this.showPreloader(true);
		if(!pageNr){
			pageNr = _currentPage;
		}
		_communicator.uploadPageXML(file,pageNr).done((page) => {
				const failedSegmentations = [];
				const missingRegions = [];
				// reset export Settings
				this._initExportSettings(pageNr);
				
				switch (page.status) {
					case 'SUCCESS':
						_segmentation[pageNr] = page;
						
						_actionController.resetActions(pageNr);

						//check if all necessary regions are available
						Object.keys(page.segments).forEach((segmentID) => {
							let segment = page.segments[segmentID];
							if($.inArray(segment.type,_presentRegions) == -1){
								//TODO as Action
								this.changeRegionSettings(segment.type,0,0);	
								missingRegions.push(segment.type);
							}
						});
						let readingOrder = [];

						page.readingOrder.forEach((segmentID) => readingOrder.push(page.segments[segmentID]));
						_actionController.addAndExecuteAction(
							new ActionChangeReadingOrder(_exportSettings[pageNr].readingOrder,readingOrder,this,_exportSettings,pageNr)
							,pageNr);
						break;
					default:
						failedSegmentations.push(pageNr);
					}
					
				_segmentedPages.push(pageNr);
				if(missingRegions.length > 0){
					_gui.displayWarning('Warning: Some regions were missing and have been added.');
				}

				this.displayPage(pageNr);
				this.showPreloader(false);
				_gui.highlightSegmentedPages(_segmentedPages);
				_gui.highlightPagesAsError(failedSegmentations);
		});
	}
	this.setPageXMLVersion = function(pageXMLVersion){
		_pageXMLVersion = pageXMLVersion;
	}

	this.downloadPageXML = function(){
		if(_globalSettings.downloadPage){
			if(_currentPageDownloadable){
				const popup_download = window.open("exportXML?version="+_pageXMLVersion);	
				try {
					popup_download.focus();
				} catch(e){
					_gui.displayWarning("Download was blocked. Please disable the Pop-up Blocker for this website.");
					_gui.highlightExportedPage(_currentPage);
				}
			}
		}else{
			$.get("exportXML?version="+_pageXMLVersion);
			_gui.highlightExportedPage(_currentPage);
		}
	}

	this.exportPageXML = function(){
		if(!_exportSettings[_currentPage]){
			this._initExportSettings(_currentPage);
		}
		_gui.setExportingInProgress(true);
		if(_settings.pages[_currentPage]){
			_exportSettings[_currentPage].fixedRegions = _settings.pages[_currentPage].segments;
		}

		_communicator.prepareExport(_currentPage,_exportSettings[_currentPage]).done(() => {
			this.setPageDownloadable(_currentPage,true);
			_gui.setExportingInProgress(false);
			_gui.highlightSavedPage(_currentPage);
			_savedPages.push(_currentPage);
			this.downloadPageXML();
		});
	}

	this.downloadSettingsXML = function(){
		if(_currentSettingsDownloadable){
			const popup_download = window.open("downloadSettings");
			try {
				popup_download.focus();
			} catch(e){
				_gui.displayWarning("Download was blocked. Please disable the Pop-up Blocker for this website.");
			}
		}
	}

	this.saveSettingsXML = function(){
		_gui.setSaveSettingsInProgress(true);
		_settings.parameters = _gui.getParameters();
		_communicator.prepareSettingsExport(_settings).done(() => {
			_currentSettingsDownloadable = true;
			_gui.setSettingsDownloadable(_currentSettingsDownloadable);
			_gui.setSaveSettingsInProgress(false);
			this.downloadSettingsXML();
		});
	}

	this.uploadSettings = function(file){
		_communicator.uploadSettings(file).done((settings) => {
			if(settings){
				_settings = settings;
				_presentRegions = [];
				Object.keys(_settings.regions).forEach((regionType) => {
					if(regionType !== 'ignore'){
						_presentRegions.push(regionType);
					}
				});
				_gui.showUsedRegionLegends(_presentRegions);
				_gui.setParameters(_settings.parameters,_settings.imageSegType,_settings.combine);

				this.displayPage(_currentPage);
				this.hideAllRegions(true);
				_gui.forceUpdateRegionHide(_visibleRegions);
				_actionController.resetActions(_currentPage);
			}
		});
	}

	this.createPolygon = function(doSegment) {
		this.endEditing(true);
		const type = doSegment ? 'segment' : 'region';
		_editor.startCreatePolygon(type);
		if(doSegment){
			_gui.selectToolBarButton('segmentPolygon',true);
		}
	}
	this.createRectangle = function(type) {
		this.endEditing(true);

		_editor.startCreateRectangle(type);
		switch(type){
			case 'segment':
				_gui.selectToolBarButton('segmentRectangle',true);
				break;
			case 'region':
				_gui.selectToolBarButton('regionRectangle',true);
				break;
			case 'ignore':
				_gui.selectToolBarButton('ignore',true);
				break;
			case 'roi':
				_gui.selectToolBarButton('roi',true);
				break;
		}
	}
	this.createCut = function() {
		this.endEditing(true);
		_editor.startCreateLine();
		_gui.selectToolBarButton('cut',true);
	}
	this.moveSelected = function() {
		if(_selected.length > 0){
			//moveLast instead of all maybe TODO
			const moveID = _selected[_selected.length-1];
			if (_selectType === "region") {
				_editor.startMovePath(moveID,'region');
			} else if(_selectType === "segment"){
				_editor.startMovePath(moveID,'segment');
			}else if(_selectType === "line"){
				//TODO
			}
			this.unSelect();
		}
	}

	this.scaleSelected = function() {
		if(_selected.length > 0){
			//moveLast instead of all maybe TODO
			const moveID = _selected[_selected.length-1];
			if (_selectType === "region") {
				_editor.startScalePath(moveID,'region');
			} else if(_selectType === "segment"){
				_editor.startScalePath(moveID,'segment');
			}else if(_selectType === "line"){
				//TODO
			}
			this.unSelect();
		}
	}
	this.endEditing = function(doAbbord){
		_editor.endEditing(doAbbord);
		_gui.unselectAllToolBarButtons();
	}
	this.deleteSelected = function() {
		const actions = [];
		for (let i = 0, selectedlength = _selected.length; i < selectedlength; i++) {
			if (_selectType === "region") {
				actions.push(new ActionRemoveRegion(this._getRegionByID(_selected[i]), _editor, _settings, _currentPage,this));
			} else if(_selectType === "segment"){
				if(!_exportSettings[_currentPage]){
					this._initExportSettings(_currentPage);
				}
				let segment = _settings.pages[_currentPage].segments[_selected[i]];
				//Check if result segment or fixed segment (null -> result region)
				if(!segment){
					segment = _segmentation[_currentPage].segments[_selected[i]];
					actions.push(new ActionRemoveSegment(segment,_editor,_segmentation,_currentPage,_exportSettings,this));
				}else{
					actions.push(new ActionRemoveSegment(segment,_editor,_settings,_currentPage,_exportSettings,this,true));
				}
			}else if(_selectType === "line"){
				let cut = _settings.pages[_currentPage].cuts[_selected[i]];
				actions.push(new ActionRemoveCut(cut,_editor,_settings,_currentPage));
			}
		}
		this.unSelect();
		let multidelete = new ActionMultiple(actions);
		_actionController.addAndExecuteAction(multidelete,_currentPage);
	}
	this.mergeSelectedSegments = function() {
		const actions = [];
		const segmentIDs = [];
		for (let i = 0, selectedlength = _selected.length; i < selectedlength; i++) {
			if(_selectType === "segment"){
				let segment = _settings.pages[_currentPage].segments[_selected[i]];
				//Check if result segment or fixed segment (null -> fixed segment)
				if(!segment){
					segment = _segmentation[_currentPage].segments[_selected[i]];
					//filter special case image (do not merge images)
					if(segment.type !== 'image'){
						if(!_exportSettings[_currentPage]){
							this._initExportSettings(_currentPage);
						}
						segmentIDs.push(segment.id);
						actions.push(new ActionRemoveSegment(segment,_editor,_segmentation,_currentPage,_exportSettings,this));
					}
				}else{
					/*//Fixed Segments can't be merged atm
					segment = _settings.pages[_currentPage].segments[_selected[i]];
					segmentIDs.push(segment.id);
					actions.push(new ActionRemoveSegment(segment,_editor,_settings,_currentPage));*/
				}
			}
		}
		if(segmentIDs.length > 1){
			_communicator.requestMergedSegment(segmentIDs,_currentPage).done((data) => {
				const mergedSegment = data;
				actions.push(new ActionAddFixedSegment(mergedSegment.id, mergedSegment.points, mergedSegment.type,
						_editor, _settings, _currentPage, _exportSettings,this));

				this.unSelect();

				let mergeAction = new ActionMultiple(actions);
				_actionController.addAndExecuteAction(mergeAction,_currentPage);
				this.selectSegment(mergedSegment.id);
				this.openContextMenu(true);
			});
		}
	}
	this.changeTypeSelected = function(newType) {
		const selectedlength = _selected.length;
		if(selectedlength || selectedlength > 0){
			const actions = [];
			for (let i = 0; i < selectedlength; i++) {
				if(_selectType === "region"){
					const regionPolygon = this._getRegionByID(_selected[i]);
					actions.push(new ActionChangeTypeRegionPolygon(regionPolygon, newType, _editor, _settings,_currentPage,this));

					this.hideRegion(newType,false);
				} else if(_selectType === "segment"){
					const isFixedSegment = (_settings.pages[_currentPage].segments[_selected[i]]);
					if(isFixedSegment){
						if(!_exportSettings[_currentPage]){
							this._initExportSettings(_currentPage);
						}
						actions.push(new ActionChangeTypeSegment(_selected[i], newType, _editor, this, _settings, _currentPage,_exportSettings,isFixedSegment));
					}else{
						if(!_exportSettings[_currentPage]){
							this._initExportSettings(_currentPage);
						}
						actions.push(new ActionChangeTypeSegment(_selected[i], newType, _editor, this, _segmentation, _currentPage,_exportSettings,isFixedSegment));
					}
				}
			}
			const multiChange = new ActionMultiple(actions);
			_actionController.addAndExecuteAction(multiChange,_currentPage);
		}
	}
	this.createBorder = function(doSegment) {
		this.endEditing(true);
		const type = doSegment ? 'segment' : 'region';
		_editor.startCreateBorder(type);
		if(doSegment){
			//currently not in gui: _gui.selectToolBarButton('createSegmentBorder',true);
		}else{
			_gui.selectToolBarButton('regionBorder',true);
		}
	}
	this.callbackNewRegion = function(regionpoints,regiontype) {
		const newID = "created" + _newPathCounter;
		_newPathCounter++;
		if(!regiontype){
			type = _presentRegions[0];
			if(!type){
				type = "other";
			}
		}else{
			type = regiontype;
		}

		const actionAdd = new ActionAddRegion(newID, regionpoints, type,
				_editor, _settings, _currentPage);

		_actionController.addAndExecuteAction(actionAdd,_currentPage);
		if(!regiontype){
			this.openContextMenu(false,newID);
		}
		_gui.unselectAllToolBarButtons();
	}

	this.callbackNewRoI = function(regionpoints) {
		let left = 1;
		let right = 0;
		let top = 1;
		let down = 0;

		$.each(regionpoints, function(index, point) {
			if(point.x < left)
				left = point.x;
			if(point.x > right)
				right = point.x;
			if(point.y < top)
				top = point.y;
			if(point.y > down)
				down = point.y;
		});

		const actions = [];

		//Create 'inverted' ignore rectangle
		actions.push(new ActionAddRegion("created" + _newPathCounter, [{x:0,y:0},{x:1,y:0},{x:1,y:top},{x:0,y:top}], 'ignore',
				_editor, _settings, _currentPage));
		_newPathCounter++;

		actions.push(new ActionAddRegion("created" + _newPathCounter, [{x:0,y:0},{x:left,y:0},{x:left,y:1},{x:0,y:1}], 'ignore',
				_editor, _settings, _currentPage));
		_newPathCounter++;

		actions.push(new ActionAddRegion("created" + _newPathCounter, [{x:0,y:down},{x:1,y:down},{x:1,y:1},{x:0,y:1}], 'ignore',
				_editor, _settings, _currentPage));
		_newPathCounter++;

		actions.push(new ActionAddRegion("created" + _newPathCounter, [{x:right,y:0},{x:1,y:0},{x:1,y:1},{x:right,y:1}], 'ignore',
				_editor, _settings, _currentPage));
		_newPathCounter++;

		_actionController.addAndExecuteAction(new ActionMultiple(actions),_currentPage);
		_gui.unselectAllToolBarButtons();
	}

	this.callbackNewFixedSegment = function(segmentpoints) {
		const newID = "created" + _newPathCounter;
		_newPathCounter++;
		let type = _presentRegions[0];
		if(!type){
			type = "other";
		}
		if(!_exportSettings[_currentPage]){
			this._initExportSettings(_currentPage);
		}
		const actionAdd = new ActionAddFixedSegment(newID, segmentpoints, type,
				_editor, _settings, _currentPage,_exportSettings,this);

		_actionController.addAndExecuteAction(actionAdd,_currentPage);
		this.openContextMenu(false,newID);
		_gui.unselectAllToolBarButtons();
	}
	this.callbackNewCut = function(segmentpoints) {
		const newID = "created" + _newPathCounter;
		_newPathCounter++;

		const actionAdd = new ActionAddCut(newID, segmentpoints,
				_editor, _settings, _currentPage);

		_actionController.addAndExecuteAction(actionAdd,_currentPage);
		_gui.unselectAllToolBarButtons();
	}

	this.transformSegment = function(segmentID,segmentPoints){
		const polygonType = this._getMainType(segmentID);
		if(polygonType === "fixed"){
			const actionTransformSegment = new ActionTransformSegment(segmentID,segmentPoints,_editor,_settings,_currentPage);
			_actionController.addAndExecuteAction(actionTransformSegment,_currentPage);
		}
	}

	this.transformRegion = function(regionID,regionSegments){
		const polygonType = this._getMainType(regionID);
		if(polygonType === "region"){
			let regionType = this._getRegionByID(regionID).type;
			let actionTransformRegion = new ActionTransformRegion(regionID,regionSegments,regionType, _editor, _settings, _currentPage,this);
			_actionController.addAndExecuteAction(actionTransformRegion,_currentPage);
			this.hideRegion(regionType,false);
		}
	}

	this.changeRegionType = function(id, type){
		const polygonType = this._getMainType(id);
		if(polygonType === "region"){
			const regionPolygon = this._getRegionByID(id);
			if(regionPolygon.type != type){
				let actionChangeType = new ActionChangeTypeRegionPolygon(regionPolygon, type, _editor, _settings, _currentPage,this);
				_actionController.addAndExecuteAction(actionChangeType,_currentPage);
			}
			this.hideRegion(type,false);
		}else if(polygonType === "segment" || polygonType === "fixed"){
			// is Segment
			this.changeSegmentType(id,type);
		}
	}

	this.changeSegmentType = function(id, type){
		const polygonType = this._getMainType(id);
		if(polygonType === "result"){
			if(_segmentation[_currentPage].segments[id].type != type){
				if(!_exportSettings[_currentPage]){
					this._initExportSettings(_currentPage);
				}
				const actionChangeType = new ActionChangeTypeSegment(id, type, _editor, this, _segmentation, _currentPage,_exportSettings,false);
				_actionController.addAndExecuteAction(actionChangeType,_currentPage);
			}
		}else if(polygonType === "fixed"){
			//segment is fixed segment not result segment
			if(_settings.pages[_currentPage].segments[id].type != type){
				const actionChangeType = new ActionChangeTypeSegment(id, type, _editor, this, _settings, _currentPage,_exportSettings,true);
				_actionController.addAndExecuteAction(actionChangeType,_currentPage);
			}
		}

	}

	this.openRegionSettings = function(regionType,doCreate){
		let region = _settings.regions[regionType];
		if(!region){
			region = _settings.regions['paragraph']; //TODO replace, is to fixed
		}
		let color;
		if(_specifiedColors[regionType]){
			color = _specifiedColors[regionType];
		}else{
			color = _colors[this.getAvailableColorIndexes()[0]];
		}

		_gui.openRegionSettings(regionType,region.minSize,region.maxOccurances,region.priorityPosition,doCreate,color);
	}

	this.getColor = function(colorID){
		return colors[colorID];
	}

	this.getColorID = function(color){
		for(let id = 0; id < _colors.length; id++){
			if(color.toCSS() === _colors[id].toCSS()){
				return id;
			}
		}
		return -1;
	}

	this.setRegionColor = function(regionType,colorID){
		_specifiedColors[regionType] = _colors[colorID];

		const pageSegments = _segmentation[_currentPage].segments;
		const pageFixedSegments = _settings.pages[_currentPage].segments;
		Object.keys(pageSegments).forEach((key) => {
			if(!pageFixedSegments[key] && !(_exportSettings[_currentPage] && $.inArray(key,_exportSettings[_currentPage].segmentsToIgnore) >= 0)){
				let segment = pageSegments[key];
				if(segment.type === regionType){
					_editor.updateSegment(segment);
				}
			}
		});
		// Iterate over FixedSegment-"Map" (Object in JS)
		Object.keys(pageFixedSegments).forEach((key) => {
			const segment = pageFixedSegments[key];
			if(segment.type === regionType){
				_editor.updateSegment(segment);
			}
		});

		const region = _settings.regions[regionType];
		// Iterate over all Polygons in Region
		Object.keys(region.polygons).forEach((polygonKey) => {
			let polygon = region.polygons[polygonKey];
			if(polygon.type === regionType){
				_editor.updateSegment(polygon);
			}
		});
		_gui.setRegionLegendColors(_segmentationtypes);
		_gui.updateAvailableColors(this.getAvailableColorIndexes());
	}

	this.getAvailableColorIndexes = function(){
		let freeColorIndexes = Array.apply(null, {length: _colors.length}).map(Number.call, Number);

		for (let regionType in _specifiedColors) {
			let index = _colors.indexOf(_specifiedColors[regionType]);
			if (index > -1) {
		    freeColorIndexes.splice(freeColorIndexes.indexOf(index), 1);
			}
		}
		return freeColorIndexes;
	}

	this.autoGenerateReadingOrder = function(){
		this.endCreateReadingOrder();
		if(!_exportSettings[_currentPage]){
			this._initExportSettings(_currentPage);
		}
		let readingOrder = [];
		const pageSegments = _segmentation[_currentPage].segments;
		const pageFixedSegments = _settings.pages[_currentPage].segments;
		
		// Iterate over Segment-"Map" (Object in JS)
		Object.keys(pageSegments).forEach((key) => {
			let hasFixedSegmentCounterpart = false;
			if(!pageFixedSegments[key] && !(_exportSettings[_currentPage] && $.inArray(key,_exportSettings[_currentPage].segmentsToIgnore) >= 0)){
				//has no fixedSegment counterpart and has not been deleted
				let segment = pageSegments[key];
				if(segment.type !== 'image'){
					readingOrder.push(segment);
				}
			}
		});
		// Iterate over FixedSegment-"Map" (Object in JS)
		Object.keys(pageFixedSegments).forEach((key) => {
			const segment = pageFixedSegments[key];
			if(segment.type !== 'image'){
				readingOrder.push(segment);
			}
		});
		readingOrder = _editor.getSortedReadingOrder(readingOrder);
		_actionController.addAndExecuteAction(new ActionChangeReadingOrder(_exportSettings[_currentPage].readingOrder,readingOrder,this,_exportSettings,_currentPage),_currentPage);
	}

	this.createReadingOrder = function(){
		_actionController.addAndExecuteAction(new ActionChangeReadingOrder(_exportSettings[_currentPage].readingOrder,[],this,_exportSettings,_currentPage),_currentPage);
		_editReadingOrder = true;
		_gui.doEditReadingOrder(true);
	}

	this.endCreateReadingOrder = function(){
		_editReadingOrder = false;
		_gui.doEditReadingOrder(false);
	}
	
	this.setBeforeInReadingOrder = function(segment1ID,segment2ID,doUpdate){
		if(!_tempReadingOrder){
			_tempReadingOrder = JSON.parse(JSON.stringify(_exportSettings[_currentPage].readingOrder));
		}
		
		let readingOrder = _tempReadingOrder;
		let index1;
		let segment1;
		let segment2;
		for(let index = 0; index < readingOrder.length; index++){
			const currentSegment = readingOrder[index];
			if(currentSegment.id === segment1ID){
				index1 = index;
				segment1 = currentSegment;
			}else if(currentSegment.id === segment2ID){
				segment2 = currentSegment;
			}
		}
		readingOrder.splice(index1,1);
		readingOrder.splice(readingOrder.indexOf(segment2), 0, segment1);
		if(doUpdate){
			_gui.setBeforeInReadingOrder(segment1ID,segment2ID);
			
			_actionController.addAndExecuteAction(new ActionChangeReadingOrder(_exportSettings[_currentPage].readingOrder,_tempReadingOrder,this,_exportSettings,_currentPage),_currentPage);
		}
		this.displayReadingOrder(_displayReadingOrder,true);
	}

	this.displayReadingOrder = function(doDisplay,doUseTempReadingOrder){
		_displayReadingOrder = doDisplay;
		if(doDisplay){
			const readingOrder = doUseTempReadingOrder? _tempReadingOrder : _exportSettings[_currentPage].readingOrder;
			_editor.displayReadingOrder(readingOrder);
		}else{
			_editor.hideReadingOrder();
		}
		_gui.displayReadingOrder(doDisplay);
	}

	this.forceUpdateReadingOrder = function(forceHard){
		_gui.forceUpdateReadingOrder(_exportSettings[_currentPage].readingOrder,forceHard);
		_gui.setRegionLegendColors(_segmentationtypes);
		_guiInput.addDynamicListeners();
		this.displayReadingOrder(_displayReadingOrder);
	}

	this.removeFromReadingOrder = function(segmentID){
		_actionController.addAndExecuteAction(new ActionRemoveFromReadingOrder(segmentID,_currentPage,_exportSettings,this),_currentPage);
	}

	this.changeImageMode = function(imageMode){
		_settings.imageSegType = imageMode;
	}

	this.changeImageCombine = function(doCombine){
		_settings.combine = doCombine;
	}

	this.applyGrid = function(){
		if(!_gridIsActive){
			_editor.addGrid();
		}
		_gridIsActive = true;
	}

	this.removeGrid = function(){
		if(_gridIsActive){
			_editor.removeGrid();
			_gridIsActive = false;
		}
	}

	this._readingOrderContains = function(segmentID){
		const readingOrder = _exportSettings[_currentPage].readingOrder;
		for(let i = 0; i < readingOrder.length; i++){
			if(readingOrder[i].id === segmentID){
				return true;
			}
		}
		return false;
	}
	// Display
	this.selectSegment = function(sectionID, info) {
		const currentType = (!info) ? "segment" : info.type;

		if(_editReadingOrder && currentType === 'segment'){
			const segment = this._getPolygon(sectionID);
			if(!this._readingOrderContains(sectionID)){
				_actionController.addAndExecuteAction(new ActionAddToReadingOrder(segment,_currentPage,_exportSettings,this),_currentPage);
			}
		} else {
			this.closeContextMenu();

			if (!this.selectmultiple || currentType !== _selectType) {
				this.unSelect();
			}
			_selectType = currentType;

			// check if segment is already selected
			const selectIndex = _selected.indexOf(sectionID);
			if (selectIndex < 0) {
				// add segment to selection
				_editor.selectSegment(sectionID, true);
				_selected.push(sectionID);
			}else{
				// unselect segment
				_editor.selectSegment(sectionID, false);
				_selected.splice(selectIndex,1);
			}
		}
	}
	this.unSelect = function(){
		for (let i = 0, selectedsize = _selected.length; i < selectedsize; i++) {
			_editor.selectSegment(_selected[i], false);
		}
		_selected = [];
	}
	this.hasSegmentsSelected = function(){
		if(_selected && _selected.length > 0){
			return true;
		}else{
			return false;
		}
	}
	this.isSegmentSelected = function(segmentID){
		if(_selected && $.inArray(segmentID, _selected) >= 0){
			return true;
		}else{
			return false;
		}
	}
	this.startRectangleSelect = function(){
		if(!_editor.isEditing){
			if(!_isSelecting){
				_editor.startRectangleSelect();
			}

			_isSelecting = true;
		}
	}
	this.rectangleSelect = function(pointA,pointB) {
		if ((!this.selectmultiple) || !(_selectType === 'fixed' || _selectType === 'segment')) {
			this.unSelect();
		}

		const inbetween = _editor.getSegmentIDsBetweenPoints(pointA,pointB);

		$.each(inbetween, function( index, id ) {
			let mainType = this._getMainType(id);
			mainType = (mainType === 'result' || mainType === 'fixed') ? 'segment' : mainType;
			if(mainType === 'segment'){
				_selected.push(id);
				_editor.selectSegment(id, true);
			}
		});

		_selectType = 'segment';
		_isSelecting = false;
	}
	this.toggleSegment = function(sectionID, isSelected, info) {
		if(!_editor.isEditing){
			_editor.selectSegment(sectionID, isSelected);
			_gui.highlightSegment(sectionID, isSelected);
		}
	}
	this.enterSegment = function(sectionID, info) {
		if(!_editor.isEditing){
			_editor.highlightSegment(sectionID, true);
			_gui.highlightSegment(sectionID, true);
		}
	}
	this.leaveSegment = function(sectionID, info) {
		if(!_editor.isEditing){
			_editor.highlightSegment(sectionID, false);
			_gui.highlightSegment(sectionID,false);
		}
	}
	this.hideAllRegions = function(doHide){
		// Iterate over Regions-"Map" (Object in JS)
		Object.keys(_settings.regions).forEach((key) => {
			const region = _settings.regions[key];
			if(region.type !== 'ignore'){
				// Iterate over all Polygons in Region
				Object.keys(region.polygons).forEach((polygonKey) => {
					let polygon = region.polygons[polygonKey];
					_editor.hideSegment(polygon.id,doHide);
				});

				_visibleRegions[region.type] = !doHide;
			}
		});
	}
	this.hideRegion = function(regionType, doHide){
		_visibleRegions[regionType] = !doHide;

		const region = _settings.regions[regionType];
		// Iterate over all Polygons in Region
		Object.keys(region.polygons).forEach((polygonKey) => {
			let polygon = region.polygons[polygonKey];
			_editor.hideSegment(polygon.id,doHide);
		});
		_gui.forceUpdateRegionHide(_visibleRegions);
	}
	this.changeRegionSettings = function(regionType, minSize, maxOccurances){
		let region = _settings.regions[regionType];
		//create Region if not present
		if(!region){
			region = {};
			region.type = regionType;
			region.polygons = {};
			_settings.regions[regionType] = region;
			_presentRegions.push(regionType);
			_gui.showUsedRegionLegends(_presentRegions);
		}
		region.minSize = minSize;
		region.maxOccurances = maxOccurances;
	}
	this.deleteRegionSettings = function(regionType){
		if($.inArray(regionType, _presentRegions) >= 0 && regionType != 'image' && regionType != 'paragraph'){
			_actionController.addAndExecuteAction(new ActionRemoveCompleteRegion(regionType,this,_editor,_settings,this),_currentPage);
		}
	}
	this.showPreloader = function(doShow){
		if(doShow){
			$('#preloader').removeClass('hide');
		}else{
			$('#preloader').addClass('hide');
		}
	}
	this.moveImage = function(delta){
		if(!_editor.isEditing){
			_editor.movePoint(delta);
		}
	}
	this.openContextMenu = function(doSelected,id){
		if(doSelected && _selected && _selected.length > 0 && (_selectType === 'region' || _selectType === "fixed" || _selectType === "segment")){
			_gui.openContextMenu(doSelected, id);
		} else {
			let polygonType = this._getMainType(id);
			if(polygonType === 'region' || polygonType === "fixed" || polygonType === "segment"){
				_gui.openContextMenu(doSelected, id);
			}
		}
	}
	this.closeContextMenu = function(){
		_gui.closeContextMenu();
	}
	this.escape = function(){
			this.unSelect();
			this.closeContextMenu();
			this.endEditing(true);
			_gui.closeRegionSettings();
	}

	this.setPageDownloadable = function(page,isDownloadable){
		if(page === _currentPage){
			// Reset Downloadable
			_currentPageDownloadable = isDownloadable;
			_gui.setDownloadable(_currentPageDownloadable);
		}
	}
	
	this.allowToLoadExistingSegmentation = function(allowLoadLocal){
		_allowLoadLocal = allowLoadLocal;
	}

	this._getRegionByID = function(id){
		let regionPolygon;
		Object.keys(_settings.regions).some((key) => {
			let region = _settings.regions[key];

			let polygon = region.polygons[id];
			if(polygon){
				regionPolygon = polygon;
				return true;
			}
		});
		return regionPolygon;
	}

	this._getMainType = function(polygonID){
		let polygon = _settings.pages[_currentPage].segments[polygonID];
		if(polygon){
			return "fixed";
		}

		polygon = _segmentation[_currentPage].segments[polygonID];
		if(polygon){
			return "result";
		}

		polygon = this._getRegionByID(polygonID);
		if(polygon){
			return "region";
		}

		polygon = _settings.pages[_currentPage].cuts[polygonID];
		if(polygon){
			return "cut";
		}
	}

	this._getPolygon = function(polygonID){
		let polygon = _settings.pages[_currentPage].segments[polygonID];
		if(polygon){
			return polygon;
		}

		polygon = _segmentation[_currentPage].segments[polygonID];
		if(polygon){
			return polygon;
		}

		polygon = this._getRegionByID(polygonID);
		if(polygon){
			return polygon;
		}

		polygon = _settings.pages[_currentPage].cuts[polygonID];
		if(polygon){
			return polygon;
		}
	}

	this._initExportSettings = function(page){
		_exportSettings[page] = {}
		_exportSettings[page].segmentsToIgnore = [];
		_exportSettings[page].segmentsToMerge = {};
		_exportSettings[page].changedTypes = {};
		_exportSettings[page].fixedRegions = [];
		_exportSettings[page].readingOrder = [];
	}
}
