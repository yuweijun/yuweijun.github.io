(function() {

    document.head.insertAdjacentHTML('beforeend', `<style id="tampermonkey-hide-body">
        body {visibility: hidden; overflow: hidden;}
        aside {display: none;}
    </style>`);

    var fn = function() {
        var tampermonkey = document.head.querySelector('#tampermonkey-hide-body');
        if (tampermonkey) tampermonkey.remove();
    };
    var timeId = setTimeout(fn, 800);

    document.addEventListener('DOMContentLoaded', function(){
        clearTimeout(timeId);
        setTimeout(fn, 50);
    }, false);

})();
