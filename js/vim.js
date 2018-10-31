// ==UserScript==
// @name         vim.js
// @namespace    http://tampermonkey.net/
// @version      0.2
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
            var height = document.documentElement.scrollHeight;

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
            var page = Math.floor(window.innerHeight / 50) * 50;
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
            // console.log(e.key, e.which, stack.e);
            stack.push(e.key);

            // check combination key shortcuts firstly
            if (stack.full()) {
                var keys = stack.dump();
                // console.log(keys);
                if (keys === 'gg') {
                    window.scroll({
                        top: 0
                    });
                    return;
                }
            }

            // check key shortcuts for J/K
            if (e.which === 74) {
                // console.log('J');
                // chrome default scroll 40px using arrow keys
                window.scrollBy({
                    top: 50
                });
            } else if (e.which === 75) {
                // console.log('K');
                window.scrollBy({
                    top: -50
                });
            }
        }

    });


})();

