var $hilighted,
    $hilightedMenuItem,
    optionDictionary = {},
    offline = {},
    API = {};

function escapeSelector (name) {
    return name.replace('<', '\\<').replace('>', '\\>');
}

function activateInternalLinks($parent) {
    $('a[href^="#"]', $parent).each(function (i, anchor) {
        $(anchor).click(function () {
            gotoSection(anchor.href.split('#')[1], true);
            return false;
        });
    });
}


/**
 * Highligth a specific option by coloring it in the menu view and section view
 */
function hilight (id) {
    var linkId, $el, $detailsWrap = $('#details-wrap');

    $el = $('div.member#' + escapeSelector(id));

    // clear old
    if ($hilighted) {
        $hilighted.removeClass('hilighted');
    }
    if ($hilightedMenuItem) {
        $hilightedMenuItem.removeClass('hilighted');
    }

    if ($el.length === 0) {
        $detailsWrap.scrollTop(0);
    } else {
        // hilight new
        $hilighted = $el;
        $hilighted.addClass('hilighted');
        $detailsWrap.scrollTop($hilighted.offset().top + $detailsWrap.scrollTop() - 160);
    }
    linkId = id.replace(/[^a-z0-9<>\\]+/gi,'.');

    $hilightedMenuItem = $('a[href="#'+ linkId +'"]').not('.plus');
    $hilightedMenuItem.addClass('hilighted');

}

/**
 * Expand and load children when necessary of current level
 */
function toggleExpand($elem, callback) {
};

function toggleSection(sectionId) {
    $section = $("#details > div.section:visible");

    // hide current section
    if($section){
        $section.hide();
    }
    if (/[^\\]</.test(sectionId)) {
        sectionId = sectionId.replace('<', '\\<').replace('>', '\\>');
    }
    $('#details > div.section#' + sectionId).show();
}


function addSectionOption(val){
    $section = $('<div class="section" id="' + val.name + '" style="display:none;"></div>').appendTo('#details');
    $('<h1>' + val.fullname.replace('<', '&lt;').replace('>', '&gt;') + '</h1>'
    + (val.description ? '<div class="section-description">' + val.description + '</div>': '')
    + (val.demo ? '<div class="demo"><h4>Try it:</h4> ' + val.demo + '</div>': '' )).appendTo($section);

    activateInternalLinks($section);
    $(document).triggerHandler({ type:"xtra.btn.section.event",id: optionDictionary[val.fullname], table: 'option' });
}

function addSectionObject(val){
    $section = $('<div class="section" id="object-' + val.name + '" style="display:none;"></div>').appendTo('#details');
    $('<h1>' + val.title + '</h1>').appendTo($section);
    $('<div class="section-description">' + val.description + '</div>').appendTo($section);

    activateInternalLinks($section);
    $(document).triggerHandler({ type:"xtra.btn.section.event",id: 'object-'+ val.name, table: 'object'});
}

function markupReturnType(s) {
    s = s.replace(/[<>]/g, function (a) {
        return {
            '<': '&lt;',
            '>': '&gt;'
        }[a];
    });
    s = s.replace(/(Axis|Chart|Element|Highcharts|Point|Renderer|Series)/g, '<a href="#$1">$1</a>');
    return s;
}

function gotoSection(anchor, hilighted) {

    var name, levels, member, isObjectArr, isObject, parts, $_parent, $_parentparent, $_menu,
        sectionId, parent,
        i,
        callbackStack = [];

    // is it an option-section or an object-section?
    parts = anchor.split("-");

    // Handle typed parent item, like series<line>
    name = anchor.split('.');
    if (name.length > 1) {
        name[name.length - 1] = '-' + name[name.length - 1];
    }
    name = name.join('-');

    levels = name.split(/[-]{1,2}/);

    isObject = (parts.length > 1 && parts[0] == 'object' || /[A-Z]/.test(name[0]));

    // Asyncronously expand parent elements of selected item
    $.each(levels, function(i) {
        callbackStack.push(function () {
            var proceed = true,
                level,
                $_menu,
                $_parent;

            if (levels[i]) {
                level = levels.slice(0, i + 1).join('-');

                if (level.indexOf('<') > -1) {
                    $_parentparent = $('#' + level.split('<')[0] + '-menu').parent();
                    level = escapeSelector(level);
                }

                $_menu = $('#' + level + '-menu');
                $_parent = $_menu.parent();

                if ($_menu && $_parent.hasClass('collapsed')) {

                    if ($_parentparent && $_parentparent.hasClass('collapsed')) {
                        toggleExpand($_parentparent);
                    }

                    // Do the toggle, and pass the next level as the callback argument
                    toggleExpand($_parent, callbackStack[i + 1]);
                    proceed = false;

                }
            }

            // For the last path item, show the section etc
            if (/[A-Z]/.test(level[0])) {
                level = 'object-' + level;
            }
            if ($('#details > div.section#' + level).length) {
                toggleSection(level);

                // empty search
                $("#search").val("");
                window.location.hash = anchor;
            }

            if (proceed && callbackStack[i + 1]) {
                callbackStack[i + 1]();
            }
        });
    });

    // Hilighting is the last operation in the async stack
    if (hilighted) {
        callbackStack.push(function () {
            hilight(name);
        });
    }

    // Start the recursive iteration
    callbackStack[0]();



}

// Startup
$(document).ready( function () {

    // convert hash from redirected dash syntax to new dot syntax
    if (/-/.test(location.hash)) {
        location.hash = location.hash.replace(/(--|-)/g, '.');
    }

    // Add scrollanimation to button
    $("a[href='#top']").click(function() {
        $("html, body").animate({ scrollTop: 0 }, "slow");
        return false;
    });

    $(window).on('scroll', function() {
        button = $("#scrollTop");
        if (!$("#top").isOnScreen()) {
            if (button.css('display') == 'none') {
                button.fadeIn("slow");
            }
        } else {
            if (button.css('display') == 'block') {
                button.fadeOut("slow");
            }
        }
    });

    $.fn.isOnScreen = function(){
        var win = $(window),
            viewport = {
                top : win.scrollTop(),
                left : win.scrollLeft()
            };

        viewport.right = viewport.left + win.width();
        viewport.bottom = viewport.top + win.height();

        var bounds = this.offset();
        bounds.right = bounds.left + this.outerWidth();
        bounds.bottom = bounds.top + this.outerHeight();

        return (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));

    };

    function updateHeight() {
        if (jQuery(window).width() >= 768) {
            // Disable
            var padding,
            height = $(window).height() - $('#top').height() - $('#footer').height();
            $("#wrapper").height(height);
            padding = $("#wrapper .container").innerHeight() - $("#wrapper .container").height();
            height = $("#wrapper").height() - padding;
            $("#wrapper-inner").height(height);
            $("#nav-wrap").height(height);
            $("#details-wrap").height(height);
        } else {
            // no height defined on the element for mobile devices
            $('#nav-wrap').removeAttr('style');
        }
    };

    updateHeight();

    $(window).resize(updateHeight);

    $('a').filter(function(){
        if (/^#.*/.test($(this).attr('href'))) {
            return true;
        }
    }).click(function() {
        var key = $(this).attr('href').replace('#', '');
        gotoSection(key, true);
        return false;
    });

    var hash = window.location.hash.replace('#', '');
    if (hash) {
        gotoSection(hash, true);
    } else {
        gotoSection('chart', true);
    }
});



