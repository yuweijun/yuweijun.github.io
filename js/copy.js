// ==UserScript==
// @name         copy.js
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  shortcuts for copy selection using alt+c
// @author       test.yu
// @match        http*://*/*
// @grant        window.close
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function se(d) {
        return d.selection ? d.selection.createRange().text : d.getSelection();
    };

    document.addEventListener('keydown', function(e) {
        if (e.altKey) {
            e.preventDefault();
            if (e.which === 67) {
                var s = se(document);
                for (var i = 0; i < frames.length && !s; i++) {
                    s = se(frames[i].document);
                }
                console.log("copy", s.toString());
                GM_setClipboard(s.toString(), {type: 'text', mimetype: 'text/plain'});
            } else if (e.which === 82) {
                // console.log('reload window');
                window.location.reload();
            } else if (e.which == 87) {
                // console.log('close window');
                window.close();
            }
        }
    });
})();

