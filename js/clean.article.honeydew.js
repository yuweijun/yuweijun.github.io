(function() {
    var f = function(selector) {
        var article = $(selector);

        var elem = article;
        while (elem.length && elem.get(0).tagName.toUpperCase() !== 'BODY') {
            elem.width(1024)
                .css({minWidth: 1024})
                .css({padding: 0})
                .css({margin: '0 auto'})
                .siblings()
                .filter(function(i, e) {return e.tagName.toUpperCase() !== 'LINK'})
                .remove();
            elem = elem.parent();
        }

        article.css({boxSizing: 'border-box', padding: 15})
            .parents().css({position: 'static', background: 'white'});
        $('body').css({background: 'honeydew', height: $(document).height()});
        return article;
    };

    window.clean = f;
})();