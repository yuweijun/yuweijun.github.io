(function() {
    var f = function(selector) {
        var article = $(selector);

        var elem = article;
        while (elem.length && elem.get(0).tagName.toUpperCase() !== 'BODY') {
            elem.css({padding: 5})
                .css({margin: '0 auto'})
                .css({minWidth: 1024})
                .siblings().remove();
            elem = elem.parent();
        }

        return article;
    };

    window.clean = f;
})();