/** @module delite/HasDropDown */
define([
	"dcl/dcl",
	"requirejs-dplugins/Promise!",
	"requirejs-dplugins/jquery!attributes/classes",	// addClass(), removeClass(), hasClass()
	"./place",
	"./popup",
	"./register",
	"./Widget",
	"./activationTracker",		// for delite-deactivated event
	"dpointer/events"		// so can just monitor for "pointerdown"
], function (dcl, Promise, $, place, popup, register, Widget) {
	
	/**
	 * Dispatched before popup widget is shown.
	 * @example
	 * document.addEventListener("delite-before-show", function (evt) {
	 *      console.log("about to show popup", evt.child);
	 * });
	 * @event module:delite/HasDropDown#delite-before-show
	 * @property {Element} child - reference to popup
	 */
	
	/**
	 * Dispatched after popup widget is shown.
	 * @example
	 * document.addEventListener("delite-after-show", function (evt) {
	 *      console.log("just displayed popup", evt.child);
	 * });
	 * @event module:delite/HasDropDown#delite-after-show
	 * @property {Element} child - reference to popup
	 */

	/**
	 * Dispatched before popup widget is hidden.
	 * @example
	 * document.addEventListener("delite-before-hide", function (evt) {
	 *      console.log("about to hide popup", evt.child);
	 * });
	 * @event module:delite/HasDropDown#delite-before-hide
	 * @property {Element} child - reference to popup
	 */
	
	/**
	 * Dispatched after popup widget is hidden.
	 * @example
	 * document.addEventListener("delite-after-hide", function (evt) {
	 *      console.log("just hid popup", evt.child);
	 * });
	 * @event module:delite/HasDropDown#delite-after-hide
	 * @property {Element} child - reference to popup
	 */
	
	/**
	 * Base class for widgets that need drop down ability.
	 * @mixin module:delite/HasDropDown
	 * @augments module:delite/Widget
	 */
	var HasDropDown = dcl(Widget, /** @lends module:delite/HasDropDown# */ {
		/**
		 * The node to display the popup around.
		 * Can be set in a template via a `attach-point` assignment,
		 * or set to a node non-descendant node, in order to set up dropdown-opening behavior on an arbitrary node.
		 * If missing, then `this` will be used.
		 * @member {Element}
		 * @protected
		 */
		anchorNode: null,

		/**
		 * The button/icon/node to click to display the drop down.
		 * Useful for widgets like Combobox which contain an `<input>` and a
		 * down arrow icon, and only clicking the icon should open the drop down.
		 * If undefined, click handler set up on `this.anchorNode` (if defined),
		 * or otherwise on `this`.
		 * @member {Element}
		 * @protected
		 */
		buttonNode: null,

		/**
		 * The widget to display as a popup.  Applications/subwidgets should *either*:
		 *
		 * 1. define this property
		 * 2. override `loadDropDown()` to return a dropdown widget or Promise for one
		 * 3. listen for a `delite-display-load` event, and then call event.setChild() with an Object like
		 *    `{child: dropDown}` or a Promise for such an Object
		 * @member {Element}
		 */
		dropDown: null,

		/**
		 * If true, make the drop down at least as wide as this widget.
		 * If false, leave the drop down at its default width.
		 * Has no effect when `dropDownPosition = ["center"]`.
		 * @member {boolean}
		 * @default true
		 */
		autoWidth: true,

		/**
		 * If true, make the drop down exactly as wide as this widget.  Overrides `autoWidth`.
		 * Has no effect when `dropDownPosition = ["center"]`.
		 * @member {boolean}
		 * @default false
		 */
		forceWidth: false,

		/**
		 * The maximum height for our dropdown.
		 * Any dropdown taller than this will have a scroll bar.
		 * Set to 0 for no max height, or -1 to limit height to available space in viewport.
		 * @member {number}
		 * @default -1
		 */
		maxHeight: -1,

		/**
		 * Controls the position of the drop down.
		 * It's an array of strings with the following values:
		 *
		 * - before: places drop down to the left of the target node/widget, or to the right in
		 * the case of RTL scripts like Hebrew and Arabic
		 * - after: places drop down to the right of the target node/widget, or to the left in
		 * the case of RTL scripts like Hebrew and Arabic
		 * - above: drop down goes above target node
		 * - below: drop down goes below target node
		 * - center: drop down is centered on the screen, like a dialog; when used, this should be
		 *   the only choice in the array
		 *
		 * The positions are tried, in order, until a position is found where the drop down fits
		 * within the viewport.
		 *
		 * @member {string[]}
		 * @default ["below", "above"]
		 */
		dropDownPosition: ["below", "above"],

		/**
		 * Focus the popup when opened by mouse or touch.  This flag should generally be left as `true` unless
		 * the popup is a menu.  Usually drop down menus don't get focus unless opened by the keyboard.
		 * @member {boolean}
		 * @default true
		 */
		focusOnPointerOpen: true,

		/**
		 * Focus the popup when opened by the keyboard.  This flag should be left as `true` except for widgets
		 * like Combobox where the focus is meant to always remain on the HasDropDown widget itself.
		 * @member {boolean}
		 * @default true
		 */
		focusOnKeyboardOpen: true,

		/**
		 * openOnHover
		 * @member {boolean}
		 * @default false
		 */
		openOnHover: false,

		/**
		 * Whether or not the drop down is open.
		 * @member {boolean}
		 * @readonly
		 */
		opened: false,

		/**
		 * Callback when the user mousedown/touchstart on the arrow icon.
		 * @private
		 */
		_dropDownPointerDownHandler: function () {
			if (this.disabled || this.readOnly) {
				return;
			}

			// In the past we would call e.preventDefault() to stop things like text selection,
			// but it doesn't work on IE10 (or IE11?) since it prevents the button from getting focus
			// (see #17262), so not doing it at all for now.
			//
			// Also, don't stop propagation, so that:
			//		1. TimeTextBox etc. can focus the <input> on mousedown
			//		2. dropDownButtonActive class applied by CssState (on button depress)
			//		3. user defined onMouseDown handler fires

			this._docHandler = this.on("pointerup", this._dropDownPointerUpHandler.bind(this), this.ownerDocument.body);

			this.toggleDropDown();
		},

		/**
		 * Callback on mouseup/touchend after mousedown/touchstart on the arrow icon.
		 * Note that this function is called regardless of what node the event occurred on (but only after
		 * a mousedown/touchstart on the arrow).
		 *
		 * If the drop down is a simple menu and the cursor is over the menu, we execute it, otherwise,
		 * we focus our drop down widget.  If the event is missing, then we are not a mouseup event.
		 *
		 * This is useful for the common mouse movement pattern with native browser `<select>` nodes:
		 *
		 * 1. mouse down on the select node (probably on the arrow)
		 * 2. move mouse to a menu item while holding down the mouse button
		 * 3. mouse up; this selects the menu item as though the user had clicked it
		 *
		 * @param {Event} [e]
		 * @private
		 */
		_dropDownPointerUpHandler: function (e) {
			/* jshint maxcomplexity:14 */

			if (this._docHandler) {
				this._docHandler.remove();
				this._docHandler = null;
			}

			// If mousedown on the button, then dropdown opened, then user moved mouse over a menu item
			// in the drop down, and released the mouse.
			if (this._currentDropDown) {
				// This if() statement deals with the corner-case when the drop down covers the original widget,
				// because it's so large.  In that case mouse-up shouldn't select a value from the menu.
				// Find out if our target is somewhere in our dropdown widget,
				// but not over our buttonNode (the clickable node)
				var c = place.position(this.buttonNode);
				if (!(e.pageX >= c.x && e.pageX <= c.x + c.w) || !(e.pageY >= c.y && e.pageY <= c.y + c.h)) {
					var t = e.target, overMenu;
					while (t && !overMenu) {
						if ($(t).hasClass("d-popup")) {
							overMenu = true;
							break;
						} else {
							t = t.parentNode;
						}
					}
					if (overMenu) {
						if (this._currentDropDown.handleSlideClick) {
							var menuItem = this.getEnclosingWidget(e.target);
							menuItem.handleSlideClick(menuItem, e);
						}
						return;
					}
				}
			}

			if (this._openDropDownPromise) {
				// Test if this is a fake mouse event caused by the user typing
				// SPACE/ENTER while using JAWS.  Jaws converts the SPACE/ENTER key into mousedown/mouseup events.
				var keyboard = e.pointerType === "mouse" && !this.hovering;

				// Focus the drop down once it opens, unless it's a menu.
				this._focusDropDownOnOpen(keyboard);
			} else {
				// The drop down arrow icon probably can't receive focus, but widget itself should get focus.
				// defer() needed to make it work on IE (test DateTextBox)
				if (this.focus) {
					this.defer(this.focus);
				}
			}
		},

		/**
		 * Helper function to focus the dropdown when it finishes loading and opening,
		 * based on `focusOnPointerOpen` and `focusOnKeyboardOpen` properties.
		 * @param {boolean} keyboard - True if the user opened the dropdown via the keyboard
		 */
		_focusDropDownOnOpen: function (keyboard) {
			this._openDropDownPromise.then(function (ret) {
				var dropDown = ret.dropDown;
				if (dropDown.focus && (keyboard ? this.focusOnKeyboardOpen : this.focusOnPointerOpen)) {
					this._focusDropDownTimer = this.defer(function () {
						dropDown.focus();
						delete this._focusDropDownTimer;
					});
				}
			}.bind(this));
		},

		preRender: function () {
			// Remove old listeners if we are re-rendering, just in case some of the listeners were put onto
			// the root node.  We don't want to make duplicate listeners.
			if (this._HasDropDownListeners) {
				this._HasDropDownListeners.forEach(function (handle) {
					handle.remove();
				});
			}
		},

		postRender: function () {
			this.anchorNode = this.anchorNode || this;
			this.buttonNode = this.buttonNode || this.anchorNode;
			this.popupStateNode = this.focusNode || this.buttonNode;

			this.popupStateNode.setAttribute("aria-haspopup", "true");

			this._HasDropDownListeners = [
				// basic listeners
				this.on("pointerdown", this._dropDownPointerDownHandler.bind(this), this.buttonNode),
				this.on("keydown", this._dropDownKeyDownHandler.bind(this), this.focusNode || this.anchorNode),
				this.on("keyup", this._dropDownKeyUpHandler.bind(this), this.focusNode || this.anchorNode),

				this.on("delite-deactivated", this._deactivatedHandler.bind(this), this.anchorNode),

				// set this.hovering when mouse is over widget so we can differentiate real mouse clicks from synthetic
				// mouse clicks generated from JAWS upon keyboard events
				this.on("pointerenter", function () {
					this.hovering = true;
				}.bind(this), this.anchorNode),
				this.on("pointerleave", function () {
					this.hovering = false;
				}.bind(this), this.anchorNode),

				// Avoid phantom click on android [and maybe iOS] where touching the button opens a centered dialog, but
				// then there's a phantom click event on the dialog itself, possibly closing it.
				// Happens in deliteful/tests/functional/ComboBox-prog.html on a phone (portrait mode), when you click
				// towards the right side of the second ComboBox.
				this.on("touchstart", function (evt) {
					// Note: need to be careful not to call evt.preventDefault() indiscriminately because that would
					// prevent [non-disabled] <input> etc. controls from getting focus.
					if (this.dropDownPosition[0] === "center") {
						evt.preventDefault();
					}
				}.bind(this), this.buttonNode),

				// Stop click events and workaround problem on iOS where a blur event occurs ~300ms after
				// the focus event, causing the dropdown to open then immediately close.
				// Workaround iOS problem where clicking a Menu can focus an <input> (or click a button) behind it.
				// Need to be careful though that you can still focus <input>'s and click <button>'s in a TooltipDialog.
				// Also, be careful not to break (native) scrolling of dropdown like ComboBox's options list.
				this.on("touchend", function (evt) {
					evt.preventDefault();
				}, this.buttonNode),
				this.on("click", function (evt) {
					evt.preventDefault();
					evt.stopPropagation();
				}, this.buttonNode)
			];

			if (this.openOnHover) {
				this._HasDropDownListeners.push(
					this.on("delite-hover-activated", this.openDropDown.bind(this), this.buttonNode),
					this.on("delite-hover-deactivated", this.closeDropDown.bind(this), this.buttonNode)
				);
			}
		},

		detachedCallback: function () {
			// If dropdown is open, close it, to avoid leaving delite/activationTracker in a strange state.
			// Put focus back on me to avoid the focused node getting destroyed, which flummoxes IE.
			if (this.opened) {
				this.closeDropDown(true);
			}

			if (this._previousDropDown) {
				popup.detach(this._previousDropDown);
				delete this._previousDropDown;
			}
		},

		destroy: function () {
			if (this.dropDown) {
				// Destroy the drop down, unless it's already been destroyed.  This can happen because
				// the drop down is a direct child of <body> even though it's logically my child.
				if (!this.dropDown._destroyed) {
					this.dropDown.destroy();
				}
				delete this.dropDown;
			}
		},

		/**
		 * Callback when the user presses a key while focused on the button node.
		 * @param {Event} e
		 * @private
		 */
		_dropDownKeyDownHandler: function (e) {
			/* jshint maxcomplexity:18 */

			if (this.disabled || this.readOnly) {
				return;
			}
			var dropDown = this._currentDropDown, target = e.target;
			if (dropDown && this.opened) {
				// Forward the keystroke to the dropdown widget.
				// deliteful/List (the dropdown for deliteful/Combobox)
				// listens for events on List#containerNode rather than the List root node.
				var forwardNode = dropDown.keyNavContainerNode || dropDown.containerNode || dropDown;
				if (dropDown.emit("keydown", e, forwardNode) === false) {
					/* false return code means that the drop down handled the key */
					e.stopPropagation();
					e.preventDefault();
					return;
				}
			}
			if (dropDown && this.opened && e.key === "Escape") {
				this.closeDropDown();
				e.stopPropagation();
				e.preventDefault();
			} else if (!this.opened &&
				(e.key === "ArrowDown" ||
					// ignore unmodified SPACE if KeyNav has search in progress
					((e.key === "Enter" || (e.key === "Spacebar" &&
						(!this._searchTimer || (e.ctrlKey || e.altKey || e.metaKey)))) &&
						//ignore enter and space if the event is for a text input
						((target.tagName || "").toLowerCase() !== "input" ||
							(target.type && target.type.toLowerCase() !== "text"))))) {
				// Toggle the drop down, but wait until keyup so that the drop down doesn't
				// get a stray keyup event, or in the case of key-repeat (because user held
				// down key for too long), stray keydown events.
				this._openOnKeyUp = true;
				e.stopPropagation();
				e.preventDefault();
			}
		},

		/**
		 * Callback when the user releases a key while focused on the button node.
		 * @param {Event} e
		 * @private
		 */
		_dropDownKeyUpHandler: function () {
			if (this._openOnKeyUp) {
				delete this._openOnKeyUp;
				this.openDropDown();
				this._focusDropDownOnOpen(true);
			}
		},

		_deactivatedHandler: function () {
			// Called when focus has shifted away from this widget and its dropdown.

			// Close dropdown but don't focus my <input>.  User may have focused somewhere else (ex: clicked another
			// input), and even if they just clicked a blank area of the screen, focusing my <input> will unwantedly
			// popup the keyboard on mobile.
			this.closeDropDown(false);
		},

		/**
		 * Creates/loads the drop down.
		 * Returns a Promise for the dropdown, or if loaded synchronously, the dropdown itself.
		 *
		 * Applications must either:
		 *
		 * 1. set the `dropDown` property to point to the dropdown (as an initialisation parameter)
		 * 2. override this method to create custom drop downs on the fly, returning a reference or promise
		 *    for the dropdown
		 * 3. listen for a `delite-display-load` event, and then call event.setChild() with an Object like
		 *    `{child: dropDown}` or a Promise for such an Object
		 *
		 * With option (2) or (3) the application is responsible for destroying the dropdown.
		 *
		 * @returns {Element|Promise} Element or Promise for the dropdown
		 * @protected
		 * @fires module:delite/DisplayContainer#delite-display-load
		 */
		loadDropDown: function () {
			if (this.dropDown) {
				return this.dropDown;
			} else {
				// tell app controller we are going to show the dropdown; it must return a pointer to the dropdown
				var dropdown;
				this.emit("delite-display-load", {
					setChild: function (val) { dropdown = val; }
				});
				return Promise.resolve(dropdown).then(function (value) { return value.child; });
			}
		},

		/**
		 * Toggle the drop-down widget; if it is open, close it, if not, open it.
		 * Called when the user presses the down arrow button or presses
		 * the down arrow key to open/close the drop down.
		 * @protected
		 */
		toggleDropDown: function () {
			if (this.disabled || this.readOnly) {
				return;
			}
			if (!this.opened) {
				return this.openDropDown();
			} else {
				return this.closeDropDown(true);	// refocus button to avoid hiding node w/focus
			}
		},

		/**
		 * Creates the drop down if it doesn't exist, loads the data
		 * if there's an href and it hasn't been loaded yet, and
		 * then opens the drop down.  This is basically a callback when the
		 * user presses the down arrow button to open the drop down.
		 * @returns {Promise} Promise for the drop down widget that fires when drop down is created and loaded.
		 * @protected
		 * @fires module:delite/HasDropDown#delite-before-show
		 * @fires module:delite/HasDropDown#delite-after-show
		 */
		openDropDown: function () {
			// If openDropDown() has already been called, don't do anything
			if (this._openDropDownPromise) {
				return this._openDropDownPromise;
			}

			// will be set to true if closeDropDown() is called before the loadDropDown() promise completes
			var canceled;

			var loadDropDownPromise = this.loadDropDown();

			this._openDropDownPromise = Promise.resolve(loadDropDownPromise).then(function (dropDown) {
				if (this._previousDropDown && this._previousDropDown !== dropDown) {
					popup.detach(this._previousDropDown);
					delete this._previousDropDown;
				}

				if (canceled) { return; }
				delete this._cancelPendingDisplay;

				this._currentDropDown = dropDown;
				var anchorNode = this.anchorNode,
					self = this;

				this.emit("delite-before-show", {
					child: dropDown,
					cancelable: false
				});

				// Generate id for anchor if it's not already specified
				if (!this.id) {
					this.id = "HasDropDown_" + this.widgetId;
				}

				dropDown._originalStyle = dropDown.style.cssText;

				var retVal = popup.open({
					parent: anchorNode,
					popup: dropDown,
					around: anchorNode,
					orient: this.dropDownPosition,
					maxHeight: this.maxHeight,
					onExecute: function () {
						self.closeDropDown(true);
					},
					onCancel: function () {
						self.closeDropDown(true);
					},
					onClose: function () {
						$(self.popupStateNode).removeClass("d-drop-down-open");
						this.opened = false;
					}
				});

				// Set width of drop down if necessary, so that dropdown width + width of scrollbar (from popup wrapper)
				// matches width of anchorNode.  Don't do anything for when dropDownPosition=["center"] though,
				// in which case popup.open() doesn't return a value.
				if (retVal && (this.forceWidth ||
						(this.autoWidth && anchorNode.offsetWidth > dropDown._popupWrapper.offsetWidth))) {
					var widthAdjust = anchorNode.offsetWidth - dropDown._popupWrapper.offsetWidth;
					dropDown._popupWrapper.style.width = anchorNode.offsetWidth + "px";

					// Workaround apparent iOS bug where width: inherit on dropdown apparently not working.
					dropDown.style.width = anchorNode.offsetWidth + "px";

					// If dropdown is right-aligned then compensate for width change by changing horizontal position
					if (retVal.corner[1] === "R") {
						dropDown._popupWrapper.style.left =
							(dropDown._popupWrapper.style.left.replace("px", "") - widthAdjust) + "px";
					}
				}

				$(this.popupStateNode).addClass("d-drop-down-open");
				this.opened = true;

				this.popupStateNode.setAttribute("aria-owns", dropDown.id);

				// Set aria-labelledby on dropdown if it's not already set to something more meaningful
				if (dropDown.getAttribute("role") !== "presentation" && !dropDown.getAttribute("aria-labelledby")) {
					dropDown.setAttribute("aria-labelledby", this.anchorNode.id);
				}

				this.emit("delite-after-show", {
					child: dropDown,
					cancelable: false
				});

				return {
					dropDown: dropDown,
					position: retVal
				};
			}.bind(this));

			// Setup a hook for closeDropDown() to abort an in-progress showDropDown() operation.
			this._cancelPendingDisplay = function () {
				if (loadDropDownPromise.cancel) { loadDropDownPromise.cancel(); }
				canceled = true;
				delete this._cancelPendingDisplay;
				delete this._openDropDownPromise;
			}.bind(this);

			return this._openDropDownPromise;
		},

		/**
		 * Closes the drop down on this widget.
		 * @param {boolean} [focus] - If true, refocus this widget.
		 * @protected
		 * @fires module:delite/HasDropDown#delite-before-hide
		 * @fires module:delite/HasDropDown#delite-after-hide
		 */
		closeDropDown: function (focus) {
			var dropdown = this._currentDropDown;

			if (this._cancelPendingDisplay) {
				this._cancelPendingDisplay();
			}
			if (this._openDropDownPromise) {
				delete this._openDropDownPromise;
			}

			if (this._focusDropDownTimer) {
				this._focusDropDownTimer.remove();
				delete this._focusDropDownTimer;
			}

			if (this.opened) {
				if (focus && this.focus) {
					this.focus();
				}

				this.emit("delite-before-hide", {
					child: dropdown,
					cancelable: false
				});

				popup.close(dropdown);
				this.opened = false;

				// Restore original height/width etc.  But don't put back display:none.
				// That is handled by the popup wrapper.
				dropdown.style.cssText = dropdown._originalStyle;
				if (dropdown.style.display === "none") {
					dropdown.style.display = "";
				}
				if (dropdown.style.visibility === "hidden") {
					dropdown.style.visibility = "";
				}

				this.emit("delite-after-hide", {
					child: dropdown,
					cancelable: false
				});
			}

			// Avoid complaint about aria-owns pointing to hidden element.
			this.popupStateNode.removeAttribute("aria-owns");

			this._previousDropDown = this._currentDropDown;
			delete this._currentDropDown;
		}
	});

	/**
	 * Widget to setup HasDropDown behavior on an arbitrary Element or Custom Element.
	 * @class module:delite/HasDropDown.HasDropDownCustomElement
	 * @augments module:delite/Widget
	 */
	HasDropDown.HasDropDownCustomElement = register("d-has-drop-down", [HTMLElement, HasDropDown], {});

	return HasDropDown;
});
