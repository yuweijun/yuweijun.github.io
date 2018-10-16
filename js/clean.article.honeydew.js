(function() {
    var f = function(selector) {
        var article = document.querySelector(selector);
        if (!article) return;

        var siblings = n => [...n.parentElement.children].filter(c => c.nodeType == 1 && c != n);
        var elem = article;

        while (elem && elem.tagName.toUpperCase() !== 'BODY') {
            elem.style.width = '1024px';
            elem.style.minWidth = '1024px';
            elem.style.padding = 0;
            elem.style.margin = '0 auto';
            elem.style.background = 'white';
            elem.style.position = 'static';

            siblings(elem).filter(e => e.tagName.toUpperCase() !== 'LINK').forEach(function(n) { n.style.display = 'none'});

            elem = elem.parentNode;
        }

        article.style.boxSizing = 'border-box';
        article.style.padding = '15px';

        var body = document.body,
            html = document.documentElement,
            height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
        document.body.style.background = 'honeydew';
        document.body.style.height = height;
        return article;
    };

    window.clean = f;
})();