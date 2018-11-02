(function() {

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
        } else if (e.metaKey) {
            // console.log("e.metaKey", e.metaKey);
        } else if (e.altKey) {
            // console.log("e.altKey", e.altKey);
        } else {
            // console.log(e.key, e.which, stack.keys);
            // check combination key shortcuts firstly
            if (stack.match(e.key, 'gg')) {
                window.scroll({
                    top: 0
                });
                return;
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

