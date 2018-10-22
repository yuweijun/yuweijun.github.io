// ==UserScript==
// @name         vim
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  emulation HOME/END/UP/DOWN shortcuts of vim
// @author       test.yu
// @match        http*://*/*
// @grant        none
// ==/UserScript==

(function() {

    var stack = {
        timeId: 0,
        e: [],
        push: function(k) {
            if (this.full()) {
                stack.clear();
            }

            this.e.push(k);
            if (this.timeId) {
                clearTimeout(this.timeId);
                this.timeId = 0;
            }

            this.timeId = setTimeout(() => {
                this.clear()
            }, 300);
        },
        dump: function() {
            return this.e.join('');
        },
        clear: function() {
            this.e.length = 0;
        },
        full: function() {
            return this.e.length === 2;
        }
    };

    document.addEventListener('keydown', function(e) {

        if (document.querySelectorAll('input:focus, textarea:focus, select:focus').length) return;

        if (e.shiftKey) {
            var body = document.body,
                html = document.documentElement,
                height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

            if (e.which === 71) {
                // console.log('G');
                window.scrollBy({
                    top: height
                });
            } else if (e.which === 72) {
                // console.log('H');
                window.scroll({
                    top: 0
                });
            } else if (e.which === 77) {
                // console.log("M");
                window.scroll({
                    top: height / 2
                });
            }
        } else if (e.ctrlKey) {
            var page = window.innerHeight;
            if (e.which === 68) {
                // console.log('D');
                // default action is bookmark
                e.preventDefault();
                window.scrollBy({
                    top: page
                });
            } else if (e.which === 85) {
                // console.log('U');
                // default action is source code
                e.preventDefault();
                window.scrollBy({
                    top: -page
                });
            }
        } else {
            stack.push(e.key);

            if (stack.full()) {
                var keys = stack.dump();
                // console.log(keys);
                if (keys === 'gg') {
                    window.scroll({
                        top: 0
                    });
                }
            } else {
                // console.log(e.key, stack.e);
            }
        }

    });


})();
