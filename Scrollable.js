/** @module delite/Scrollable */
define([
	"dcl/dcl",
	"jquery/css",	// for .css()
	"dojo/_base/fx",
	"dojo/fx/easing",
	"delite/Widget",
	"delite/Invalidating",
	"jquery/attributes/classes",	// for toggleClass()
	"jquery/event",		// for .on()
	"delite/theme!./Scrollable/themes/{{theme}}/Scrollable_css"
], function (dcl, $, baseFx, easing, Widget, Invalidating) {

	/**
	 * A mixin which adds scrolling capabilities to a widget.
	 *
	 * When mixed into a host widget, this mixin brings scrolling capabilities
	 * based on the overflow: auto CSS property.
	 *
	 * By default, the scrolling capabilities are added to the widget
	 * node itself. The host widget can chose the node thanks to the property
	 * `scrollableNode` which must be set at latest in its `buildRendering()`
	 * method.
	 *
	 * During interactive or programmatic scrolling, native "scroll"
	 * events are emitted, and can be listened to as follows (here,
	 * `scrollWidget` is the widget into which this mixin is mixed):
	 *
	 * ```js
	 * scrollWidget.on("scroll", function () {
	 *   ...
	 * }
	 * ```
	 *
	 * For widgets that customize the `scrollableNode` property,
	 * the events should be listened to on `widget.scrollableNode`:
	 *
	 * ```js
	 * scrollWidget.scrollableNode.on("scroll", function () {
	 *   ...
	 * }
	 * ```
	 *
	 * @mixin module:delite/Scrollable
	 * @augments module:delite/Widget
	 * @augments module:delite/Invalidating
	 */
	return dcl([Widget, Invalidating], /** @lends module:delite/Scrollable# */{

		/**
		 * The direction of the interactive scroll. Possible values are:
		 * "vertical", "horizontal", "both, and "none".
		 *
		 * Note that scrolling programmatically using `scrollTo()` is
		 * possible on both horizontal and vertical directions independently
		 * on the value of `scrollDirection`.
		 * @member {string}
		 * @default "vertical"
		 */
		scrollDirection: "vertical",

		/**
		 * Designates the descendant node of this widget which is made scrollable.
		 *
		 * If not set otherwise before the `buildRendering()`
		 * method of the mixin is executed, it is set by default to this widget
		 * itself (`this`).
		 *
		 * Note that this property can be set only at construction time, at latest
		 * in the `buildRendering()` method of the host widget into which this class is mixed.
		 * It should not be changed afterwards.
		 * Typically, this property can be set by a host widget which needs scrolling
		 * capabilities on one its descendant nodes.
		 *
		 * @member {Element}
		 * @default null
		 */
		scrollableNode: null,

		preCreate: function () {
			this.addInvalidatingProperties("scrollDirection");
		},

		postCreate: function () {
			this.invalidateRendering("scrollDirection");
		},

		buildRendering: dcl.after(function () {
			// Do it using after advice to give a chance to a custom widget to
			// set the scrollableNode at latest in an overridden buildRendering().
			if (!this.scrollableNode) {
				this.scrollableNode = this; // If unspecified, defaults to 'this'.
			}

			// Disable text selection in scrollable node as per
			// http://stackoverflow.com/questions/2700000/how-to-disable-text-selection-using-jquery
			this.scrollableNode.setAttribute("unselectable", "on");
			$(this.scrollableNode)
				.css("user-select", "none") // maps to WebkitUserSelect, etc.
				.on("selectstart", false);
		}),

		refreshRendering: dcl.superCall(function (sup) {
			return function (props) {
				sup.call(this, props);
				if (props && props.scrollDirection) {
					$(this.scrollableNode)
						.toggleClass("d-scrollable", this.scrollDirection !== "none")
						.toggleClass("d-scrollable-h", /^(both|horizontal)$/.test(this.scrollDirection))
						.toggleClass("d-scrollable-v", /^(both|vertical)$/.test(this.scrollDirection));
				}
			};
		}),

		destroy: function () {
			this._stopAnimation();
		},

		/**
		 * Returns true if container's scroll has reached the maximum limit at
		 * the top of the contents.  Returns false otherwise.
		 * @example
		 * var scrollableNode = scrollableWidget.scrollableNode;
		 * scrollableNode.on("scroll", function () {
		 *   if (scrollableWidget.isTopScroll()) {
		 *     console.log("Scroll reached the maximum limit at the top");
		 *   }
		 * }
		 * @returns {boolean}
		 */
		isTopScroll: function () {
			return this.scrollableNode.scrollTop === 0;
		},

		/**
		 * Returns true if container's scroll has reached the maximum limit at
		 * the bottom of the contents. Returns false otherwise. 
		 * @example
		 * var scrollableNode = scrollableWidget.scrollableNode;
		 * scrollableNode.on("scroll", function () {
		 *   if (scrollableWidget.isBottomScroll()) {
		 *     console.log("Scroll reached the maximum limit at the bottom");
		 *   }
		 * }
		 * @returns {boolean}
		 */
		isBottomScroll: function () {
			var scrollableNode = this.scrollableNode;
			return scrollableNode.offsetHeight + scrollableNode.scrollTop >=
				scrollableNode.scrollHeight;
		},

		/**
		 * Returns true if container's scroll has reached the maximum limit at
		 * the left of the contents. Returns false otherwise. 
		 * @example
		 * var scrollableNode = scrollableWidget.scrollableNode;
		 * scrollableNode.on("scroll", function () {
		 *   if (scrollableWidget.isLeftScroll()) {
		 *     console.log("Scroll reached the maximum limit at the left");
		 *   }
		 * }
		 * @returns {boolean}
		 */
		isLeftScroll: function () {
			return this.scrollableNode.scrollLeft === 0;
		},

		/**
		 * Returns true if container's scroll has reached the maximum limit at
		 * the right of the contents. Returns false otherwise. 
		 * @example
		 * var scrollableNode = scrollableWidget.scrollableNode;
		 * scrollableNode.on("scroll", function () {
		 *   if (scrollableWidget.isRightScroll()) {
		 *     console.log("Scroll reached the maximum limit at the right");
		 *   }
		 * }
		 * @returns {boolean}
		 */
		isRightScroll: function () {
			var scrollableNode = this.scrollableNode;
			return scrollableNode.offsetWidth + scrollableNode.scrollLeft >= scrollableNode.scrollWidth;
		},

		/**
		 * Returns the current amount of scroll, as an object with x and y properties
		 * for the horizontal and vertical scroll amount.
		 * This is a convenience method and it is not supposed to be overridden.
		 * @returns {Object}
		 */
		getCurrentScroll: function () {
			return {x: this.scrollableNode.scrollLeft, y: this.scrollableNode.scrollTop};
		},

		/**
		 * Scrolls by the given amount.
		 * @param {Object} by The scroll amount.  An object with x and/or y properties, for example
		 * `{x: 0, y: -5} or {y: -29}`.
		 * @param {number} duration - Duration of scrolling animation in milliseconds.
		 * If 0 or unspecified, scrolls without animation.
		 */
		scrollBy: function (by, duration) {
			var to = {};
			if (by.x !== undefined) {
				to.x = this.scrollableNode.scrollLeft + by.x;
			}
			if (by.y !== undefined) {
				to.y = this.scrollableNode.scrollTop + by.y;
			}
			this.scrollTo(to, duration);
		},

		/**
		 * Scrolls to the given position.
		 * @param {Object} to The scroll destination position.  An object with w and/or y properties, for example
		 * `{x: 0, y: -5} or {y: -29}`.
		 * @param {number} [duration] Duration of scrolling animation in milliseconds. 
		 * If 0 or unspecified, scrolls without animation.
		 * @returns {module:dojo/_base/fx/Animation}
		 */
		scrollTo: function (to, duration) {
			var scrollableNode = this.scrollableNode;
			this._stopAnimation();
			if (!duration || duration <= 0) { // shortcut
				if (to.x !== undefined) {
					scrollableNode.scrollLeft = to.x;
				}
				if (to.y !== undefined) {
					scrollableNode.scrollTop = to.y;
				}
			} else {
				var from = {
					x: to.x !== undefined ? scrollableNode.scrollLeft : undefined,
					y: to.y !== undefined ? scrollableNode.scrollTop : undefined
				};
				var self = this;
				var anim = function () {
					// dojo/_base/fx._Line cannot be used for animating several
					// properties at once (scrollTop and scrollLeft in our case). 
					// Hence, using instead a custom function:
					var Curve = function (/*int*/ start, /*int*/ end) {
						this.start = start;
						this.end = end;
					};
					Curve.prototype.getValue = function (/*float*/ n) {
						return {
							x: ((to.x - from.x) * n) + from.x,
							y: ((to.y - from.y) * n) + from.y
						};
					};
					var animation = new baseFx.Animation({
						beforeBegin: function () {
							if (this.curve) {
								delete this.curve;
							}
							animation.curve = new Curve(from, to);
						},
						onAnimate: function (val) {
							if (val.x !== undefined) {
								scrollableNode.scrollLeft = val.x;
							}
							if (val.y !== undefined) {
								scrollableNode.scrollTop = val.y;
							}
						},
						easing: easing.expoInOut, // TODO: IMPROVEME
						duration: duration,
						rate: 20 // TODO: IMPROVEME
					});
					self._animation = animation;
					return animation;
				};
				anim().play();
			}
		},

		/**
		 * Stops the scrolling animation if it is currently playing.
		 * Does nothing otherwise.
		 */
		_stopAnimation: function () {
			if (this._animation && this._animation.status() === "playing") {
				this._animation.stop();
			}
		}
	});
});
