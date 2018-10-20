(function() {

    var element = {
        siblings: function() {
            return [...this.parentElement.children].filter(c => c.nodeType == 1 && c != this);
        },
        attr: function(attributes) {
            if (this.nodeType === 3 || this.nodeType === 8 || this.nodeType === 2) {
                return this;
            }

            if (typeof attributes === 'string') {
                return this.getAttribute(attributes);
            } else {
                for (var key in attributes) {
                    this.setAttribute(key, attributes[key]);
                }
                return this;
            }
        },
        css: function(styles) {
            if (this.nodeType === 1) {
                for (var key in styles) {
                    this.style[key] = styles[key];
                }
            }

            return this;
        },
        parents: function() {
            var matched = [],
                elem = this;
            while (elem) {
                if (elem.nodeType === 9) {
                    break;
                }

                if (elem.nodeType === 1) {
                    if (matched.indexOf(elem) === -1) {
                        matched.push(elem);
                    }
                }

                elem = elem.parentNode;
            }

            return matched;
        },
        hasClass: function(selector) {
            var classes = this.getAttribute && this.getAttribute("class") || "",
                className = " " + selector + " ";
            if (this.nodeType === 1 && (" " + classes + " ").indexOf(className) > -1) {
                return true;
            }

            return false;
        },
        prepend: function() {
            [...arguments].forEach(elem => {
                $(elem).forEach(e => this.insertBefore(e, this.firstElementChild));
            });

            return this;
        }
    };

    // transform object of Node/NodeList/Array to enhanced Array instance
    var $ = function(array) {
        var attr = {};

        if (!arguments.length) {
            array = [];
        } else if (array instanceof Node) {
            array = [array];
        } else if (array instanceof NodeList) {
            array = [...array];
        } else if (array instanceof HTMLCollection) {
            array = [...array];
        }

        ['filter', 'map', 'slice', 'sort'].forEach(function(method) {
            attr[method] = {
                value: function() {
                    var array = Array.prototype[method].apply(this, arguments);
                    return $(array);
                },
                enumerable: false
            };
        });
        ("blur focus focusin focusout resize scroll click dblclick " +
            "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
            "change select submit keydown keypress keyup").split(" ").forEach(function(event) {
            attr[event] = {
                value: function() {
                    this.forEach(elem => {
                        if (arguments.length) {
                            [...arguments].forEach((fn) => {
                                elem.addEventListener(event, fn, false);
                            });
                        } else {
                            elem[event]();
                        }
                    });

                    return this;
                },
                enumerable: false
            };
        });
        attr.first = {
            value: function() {
                var array = Array.prototype.slice.call(this, 0, 1);
                return $(array);
            },
            enumerable: false
        };
        attr.last = {
            value: function() {
                var array = Array.prototype.slice.call(this, this.length - 1, this.length);
                return $(array);
            },
            enumerable: false
        };
        attr.remove = {
            value: function() {
                this.forEach(function(elem) {
                    if (elem.nodeType === 1) {
                        elem.remove();
                    }
                });
                return this;
            },
            enumerable: false
        };
        attr.siblings = {
            value: function() {
                var array = [];
                this.forEach(function(elem) {
                    array = array.concat(element.siblings.apply(elem, arguments));
                });

                return $(array);
            },
            enumerable: false
        };
        attr.parents = {
            value: function() {
                var array = [];
                this.forEach(function(elem) {
                    element.parents.apply(elem, arguments).forEach(function(p) {
                        if (array.indexOf(p) === -1) {
                            array.push(p);
                        }
                    });
                });
                return $(array);
            },
            enumerable: false
        };
        attr.closest = {
            value: function(selector) {
                var array = [];
                this.forEach(elem => array.push(elem.closest(selector)));
                return $(array);
            },
            enumerable: false
        };
        attr.hasClass = {
            value: function() {
                this.forEach(elem => {
                    if (!element.hasClass.apply(elem, arguments)) return false;
                });
                return true;
            },
            enumerable: false
        };
        attr.attr = {
            value: function() {
                if (arguments.length) {
                    if (typeof arguments[0] === 'string') {
                        var values = [];
                        this.forEach(elem => values.push(element.attr.apply(elem, arguments)));
                        if (values.length === 1) {
                            return values[0];
                        }
                        return values;
                    } else {
                        this.forEach(elem => element.attr.apply(elem, arguments));
                    }
                }
                return this;
            },
            enumerable: false
        };
        attr.css = {
            value: function() {
                this.forEach(elem => element.css.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        // attr.after
        // attr.before
        // attr.append
        // attr.parent
        // attr.addClass
        // attr.removeClass
        // attr.hide
        // attr.show
        // attr.val
        attr.prepend = {
            value: function() {
                this.forEach(elem => element.prepend.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.querySelectorAll = {
            value: function(selector) {
                if (typeof selector === 'string') {
                    var array = [];
                    this.forEach(function(elem) {
                        var subs = elem.querySelectorAll(selector);
                        array.push(...subs);
                    });
                    return $(array);
                } else {
                    return $(selector);
                }
            },
            enumerable: false
        };
        attr.readable = {
            value: function() {
                if (this.length === 0) return;

                var parents = this.parents();

                this.forEach(function(elem) {
                    while (elem && elem.tagName.toUpperCase() !== 'BODY') {
                        var $elem = $(elem);
                        $elem.css({
                            padding: 0,
                            margin: '0 auto',
                            minWidth: '1024px',
                            width: '1024px',
                            position: 'static'
                        });

                        $elem.siblings().filter(function(elem) {
                            if (elem.tagName.toUpperCase() === 'LINK') {
                                return false;
                            }
                            if (parents.indexOf(elem) > -1) {
                                return false;
                            }
                            return true;
                        }).remove();

                        elem = elem.parentNode;
                    }
                });

                $(this).css({
                    padding: '15px',
                    boxSizing: 'border-box'
                });

                var body = document.body,
                    html = document.documentElement;
                document.body.style.height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

                return this;
            },
            enumerable: false
        };

        return Object.create(array, attr);
    };

    Object.defineProperty(Document.prototype, '$', {
        get() {
            return function() {
                if (arguments.length === 0) {
                    return $(document);
                } else if (!(arguments[0] instanceof Object)) {
                    return $(document.querySelectorAll.apply(document, arguments));
                } else {
                    return $(arguments[0]);
                }
            };
        },
        enumerable: false
    });

    Object.defineProperty(NodeList.prototype, '$', {
        get() {
            return $(this);
        },
        enumerable: false
    });

})();