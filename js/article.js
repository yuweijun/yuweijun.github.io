(function() {

    var stack = document.$.stack;

    document.addEventListener('keydown', function(e) {
        if (document.querySelectorAll('input:focus, textarea:focus, select:focus').length) return;

        stack.push(e.key);

        if (stack.match(e.key, 'dd')) {
            document.$('article').tee().readable();
        }
    });

})();

