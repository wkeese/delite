define([
     "doh/runner",
     "dojo/sniff",
     "require",
     "./accordion/module",
     "./badge/module",
     "./bidi/module",
     "./button/module",
     "./checkbox/module",
     "./combobox/module",
     "./contentpane/module",
     "./edgetoedgecategory/module",
     "./edgetoedgelist/module",
     "./edgetoedgestorelist/module",
     "./expandingtextarea/module",
     "./filteredlistmixin/module",
     "./fixedbars/module",
     "./fixedsplitter/module",
     "./heading/module",
     "./iconcontainer/module",
     "./iconmenu/module",
     "./listitem/module",
     "./longlistmixin/module",
     "./opener/module",
     "./pageindicator/module",
     "./progressindicator/module",
     "./radiobutton/module",
     "./roundrect/module",
     "./roundrectlist/module",
     "./roundrectstorelist/module",
     "./slider/module",
     "./spinwheel/module",
     "./spinwheeldatepicker/module",
     "./swapview/module",
     "./switch/module",
     "./tabbar/module",
     "./templating/module",
     "./textarea/module",
     "./textbox/module",
     "./toolbarbutton/module",
     "./valuepickerdatepicker/module",
     "./valuepickertimepicker/module",
     "./view/module"
], function(doh, has, require){
	try{
		doh.registerUrl("dui.mobile.tests.doh.URLProperty", require.toUrl("./TestURLProp.html"),999999);
		doh.registerUrl("dui.mobile.tests.doh.URLProperty", require.toUrl("./TestURLProp2.html"),999999);
	}catch(e){
		doh.debug(e);
	}
});
