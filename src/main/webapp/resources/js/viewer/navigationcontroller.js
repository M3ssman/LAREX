function NavigationController(gui,viewer) {
	let _gui = gui;
	let _viewer = viewer;

	//Navigation
	this.center = function () {
		_viewer.center();
	}
	this.setZoom = function (zoomfactor, point) {
		_viewer.setZoom(zoomfactor, point);
		_gui.updateZoom();
	}
	this.zoomIn = function (zoomfactor, point) {
		_viewer.zoomIn(zoomfactor, point);
		_gui.updateZoom();
	}
	this.zoomOut = function (zoomfactor, point) {
		_viewer.zoomOut(zoomfactor, point);
		_gui.updateZoom();
	}
	this.zoomFit = function () {
		_viewer.center();
		_viewer.zoomFit();
		_gui.updateZoom();
	}
	this.move = function (x, y) {
		_viewer.move(x, y);
	}
}
