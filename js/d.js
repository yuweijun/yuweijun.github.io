// ==UserScript==
// @name         d.js
// @namespace    http://tampermonkey.net/
// @version      0.1
// @author       test.yu
// @match        http*://*/*
// @run-at       document-start
// ==/UserScript==

(function() {

    var element = {
        siblings: function() {
            return [...this.parentNode.children].filter(c => c.nodeType == 1 && c != this);
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
            var classes = " " + (this.getAttribute("class") || "") + " ",
                className = " " + selector + " ";
            if (this.nodeType === 1 && classes.indexOf(className) > -1) {
                return true;
            }

            return false;
        },
        addClass: function(selector) {
            if (!element.hasClass.apply(this, arguments)) {
                var classes = this.getAttribute("class") || "",
                    className = classes + " " + selector + " ";
                if (this.nodeType === 1) {
                    this.setAttribute('class', className.trim());
                }
            }

            return this;
        },
        removeClass: function(selector) {
            if (element.hasClass.apply(this, arguments)) {
                var classes = " " + (this.getAttribute("class") || "") + " ",
                    className = " " + selector + " ";
                if (this.nodeType === 1) {
                    while (classes.indexOf(className) > -1) {
                        classes = classes.replace(className, " ");
                    }
                    this.setAttribute('class', classes.trim());
                }
            }

            return this;
        },
        hide: function() {
            this.style.display = 'none';
            return this;
        },
        show: function() {
            this.style.display = 'block';
            return this;
        },
        after: function(elem) {
            if (this.parentNode) {
                this.parentNode.insertBefore(elem, this.nextSibling);
            }

            return this;
        },
        before: function(elem) {
            if (this.parentNode) {
                this.parentNode.insertBefore(elem, this);
            }
            return this;
        },
        empty: function() {
            if (this.nodeType === 1) {
                this.textContent = "";
            }

            return this;
        },
        html: function() {
            if (this.nodeType === 1) {
                if (arguments.length) {
                    this.innerHTML = arguments[0];
                } else {
                    return this.innerHTML;
                }
            }

            return this;
        },
        prepend: function(nodes) {
            if (nodes) {
                if (nodes instanceof Array) {
                    nodes.forEach(elem => this.insertBefore(elem, this.firstElementChild));
                } else {
                    $(nodes).forEach(elem => this.insertBefore(elem, this.firstElementChild));
                }
            }

            return this;
        },
        append: function(nodes) {
            if (nodes) {
                if (nodes instanceof Array) {
                    nodes.forEach(elem => this.appendChild(elem));
                } else {
                    $(nodes).forEach(elem => this.appendChild(elem));
                }
            }

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
        ("blur focus click mouseover mouseenter mouseleave " +
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
        attr.parent = {
            value: function() {
                var array = [];
                this.forEach(elem => {
                    if (elem) {
                        array.push(elem.parentNode);
                    } else {
                        array.push(null);
                    }
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
                for (var i = 0; i < this.length; i++) {
                    if (element.hasClass.apply(this[i], arguments)) {
                        return true;
                    }
                }
                return false;
            },
            enumerable: false
        };
        attr.addClass = {
            value: function() {
                this.forEach(elem => element.addClass.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.removeClass = {
            value: function() {
                this.forEach(elem => element.removeClass.apply(elem, arguments));
                return this;
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
        attr.hide = {
            value: function() {
                this.forEach(elem => element.hide.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.show = {
            value: function() {
                this.forEach(elem => element.show.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.after = {
            value: function() {
                this.first().forEach(elem => element.after.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.before = {
            value: function() {
                this.first().forEach(elem => element.before.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.empty = {
            value: function() {
                this.forEach(elem => element.empty.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.html = {
            value: function() {
                if (arguments.length) {
                    this.forEach(elem => element.html.apply(elem, arguments));
                } else {
                    return this.map(elem => element.html.apply(elem, arguments));
                }
                return this;
            },
            enumerable: false
        };
        attr.prepend = {
            value: function() {
                this.first().forEach(elem => element.prepend.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.append = {
            value: function() {
                this.first().forEach(elem => element.append.apply(elem, arguments));
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
        attr.tee = {
            value: function() {
                console.log(...this);
                return this;
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
                            width: '100%',
                            maxWidth: '1024px',
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

                document.body.style.height = document.documentElement.scrollHeight + 'px';
                document.head.querySelectorAll('script').$.remove();

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
