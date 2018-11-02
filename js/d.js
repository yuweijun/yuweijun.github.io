(function() {

    var element = {
        siblings() {
            return Array.from(this.parentNode.children).filter(c => c.nodeType == 1 && c != this);
        },
        attr(attributes) {
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
        css(styles) {
            if (this.nodeType === 1) {
                for (var key in styles) {
                    this.style[key] = styles[key];
                }
            }

            return this;
        },
        parents() {
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
        hasClass(selector = '') {
            var classes = " " + (this.getAttribute("class") || "") + " ",
                className = " " + selector + " ";
            if (this.nodeType === 1 && classes.indexOf(className) > -1) {
                return true;
            }

            return false;
        },
        addClass(selector = '') {
            if (!element.hasClass.apply(this, arguments)) {
                var classes = this.getAttribute("class") || "",
                    className = classes + " " + selector + " ";
                if (this.nodeType === 1) {
                    this.setAttribute('class', className.trim());
                }
            }

            return this;
        },
        removeClass(selector = '') {
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
        hide() {
            this.style.display = 'none';
            return this;
        },
        show() {
            this.style.display = 'block';
            return this;
        },
        after(elem) {
            if (this.parentNode) {
                this.parentNode.insertBefore(elem, this.nextSibling);
            }

            return this;
        },
        before(elem) {
            if (this.parentNode) {
                this.parentNode.insertBefore(elem, this);
            }
            return this;
        },
        empty() {
            if (this.nodeType === 1) {
                this.textContent = "";
            }

            return this;
        },
        html() {
            if (this.nodeType === 1) {
                if (arguments.length) {
                    this.innerHTML = arguments[0];
                } else {
                    return this.innerHTML;
                }
            }

            return this;
        },
        prepend(nodes = []) {
            if (nodes instanceof Array) {
                nodes.forEach(elem => this.insertBefore(elem, this.firstElementChild));
            } else {
                $(nodes).forEach(elem => this.insertBefore(elem, this.firstElementChild));
            }

            return this;
        },
        append(nodes = []) {
            if (nodes instanceof Array) {
                nodes.forEach(elem => this.appendChild(elem));
            } else {
                $(nodes).forEach(elem => this.appendChild(elem));
            }

            return this;
        }
    };

    // transform object of Node/NodeList/Array to enhanced Array instance
    var $ = function(array = []) {
        var attr = {};

        if (array instanceof Node) {
            array = [array];
        } else if (array instanceof NodeList) {
            array = [...array];
        } else if (array instanceof HTMLCollection) {
            array = [...array];
        }

        ['filter', 'map', 'slice', 'sort'].forEach(function(method) {
            attr[method] = {
                value() {
                    var array = Array.prototype[method].apply(this, arguments);
                    return $(array);
                },
                enumerable: false
            };
        });
        ("blur focus click mouseover mouseenter mouseleave " +
            "change select submit keydown keypress keyup").split(" ").forEach(function(event) {
            attr[event] = {
                value() {
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
            value() {
                var array = Array.prototype.slice.call(this, 0, 1);
                return $(array);
            },
            enumerable: false
        };
        attr.last = {
            value() {
                var array = Array.prototype.slice.call(this, this.length - 1, this.length);
                return $(array);
            },
            enumerable: false
        };
        attr.remove = {
            value() {
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
            value() {
                var array = [];
                this.forEach(function(elem) {
                    array = array.concat(element.siblings.apply(elem, arguments));
                });

                return $(array);
            },
            enumerable: false
        };
        attr.parent = {
            value() {
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
            value() {
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
            value(selector = '') {
                if (!selector) {
                    return this;
                }
                var array = [];
                this.forEach(elem => array.push(elem.closest(selector)));
                return $(array);
            },
            enumerable: false
        };
        attr.hasClass = {
            value() {
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
            value() {
                this.forEach(elem => element.addClass.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.removeClass = {
            value() {
                this.forEach(elem => element.removeClass.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.attr = {
            value() {
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
            value() {
                this.forEach(elem => element.css.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.hide = {
            value() {
                this.forEach(elem => element.hide.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.show = {
            value() {
                this.forEach(elem => element.show.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.after = {
            value() {
                this.first().forEach(elem => element.after.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.before = {
            value() {
                this.first().forEach(elem => element.before.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.empty = {
            value() {
                this.forEach(elem => element.empty.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.html = {
            value() {
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
            value() {
                this.first().forEach(elem => element.prepend.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.append = {
            value() {
                this.first().forEach(elem => element.append.apply(elem, arguments));
                return this;
            },
            enumerable: false
        };
        attr.querySelectorAll = {
            value(selector) {
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
            value() {
                console.log(...this);
                return this;
            },
            enumerable: false
        };
        attr.readable = {
            value() {
                if (this.length === 0) return;

                var parents = this.parents();

                this.forEach(function(elem) {
                    while (elem && elem.tagName.toUpperCase() !== 'BODY') {
                        var $elem = $(elem);
                        $elem.css({
                            padding: 0,
                            margin: '0 auto',
                            display: 'block',
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

                document.head.querySelectorAll('script').$.remove();
                $(document.head).append(document.body.querySelectorAll('link'));
                document.body.style.height = document.documentElement.scrollHeight + 'px';

                return this;
            },
            enumerable: false
        };

        return Object.create(array, attr);
    };

    var stack = {
        timeId: 0,
        keys: [],
        push(k) {
            let code = k.charCodeAt(0);
            if (code < 97 || code > 122) {
                return this;
            }

            if (this.full()) {
                stack.clear();
            }

            this.keys.push(k);
            if (this.timeId) {
                clearTimeout(this.timeId);
                this.timeId = 0;
            }

            this.timeId = setTimeout(() => {
                this.clear()
            }, 300);

            return this;
        },
        dump() {
            return this.keys.join('');
        },
        clear() {
            this.keys.length = 0;
            return this;
        },
        full() {
            return this.keys.length === 2;
        },
        match(k, v) {
            this.push(k);
            if (stack.full()) {
                return this.dump() === v;
            }

            return false;
        }
    };

    Object.defineProperty(Document.prototype, '$', {
        get() {
            let fn = function() {
                if (arguments.length === 0) {
                    return $(document);
                } else if (typeof arguments[0] === 'string') {
                    return $(document.querySelectorAll.apply(document, arguments));
                } else {
                    return $(arguments[0]);
                }
            };
            fn.stack = stack;

            return fn;
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
