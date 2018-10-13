(function() {
    var f = function(selector) {
        var article = $(selector);

        var elem = article;
        while (elem.length && elem.get(0).tagName.toUpperCase() !== 'BODY') {
            elem.width(1024)
                .css({margin: '0 auto', maxWidth: 1024})
                .siblings().remove();
            elem = elem.parent();
        }

        return article;
    };

    window.clean = f;
})();