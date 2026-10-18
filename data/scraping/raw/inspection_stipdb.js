var daadFormData = {}
var currentViewport = false;
daadFormData.page = 1;
daadFormData.epp = 5;
daadFormData.searchSubmitted = false;
var daadSearchAfterNavigationHappened = false;

function daadInitStipDb(viewport)
{
    currentViewport = viewport;

    if ($('#ifa-stipendien-detail').length > 0) {
        daadInitTabs();
        daadInitApplicationButton();
        daadInitStipDbTooltip();
        daadInitYourSelection();
        daadInitTargetCountrySelection();

        $('#select-application-info-form').submit(() => {
            /**
             * ACHTUNG:
             * Die Felder "#select-status-details" und "#select-country-detail" sind im Frontend falsch benannt.
             * Um Rattenschwänze zu vermeiden ist die Benennung daher nur an dieser Stelle korrigiert.
             */
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                'event': 'stipdb-auslaender-application-info',
                'country': $('#select-status-detail option:selected').text(),
                'status': $('#select-country-detail option:selected').text(),
            });
        });
    } else {
        daadInitTabs();
        daadInitApplicationButton();
        daadInitCleanupSearchVars(false);
        daadInitSelectboxes();
        daadInitStipDbForm(currentViewport);
        daadInitStipDbFormActions();
        daadGetResultlist();
        daadInitStipDbTooltip();
        daadShowHidePrintButton('show');
    }
}

function daadShowHidePrintButton(action) {

    if(action == 'hide') {
        $('.page-format').hide();
        $('.page-format').addClass('page-format-stipdb');
        $('.mobile-pdf-url').addClass('hidden');
    }

    if(action == 'show') {
        $('.page-format').show();
        $('.mobile-pdf-url').removeClass('hidden');
    }
}

function daadInitCleanupSearchVars(doClear)
{
    if (!window.location.href.match(/back\=1/) || doClear) {
        jsParamstatus = '';
        if (!window.location.href.match(/\/laenderinformationen\//)) {
            jsParamorigin = '';
        }
        jsParamsubjectGrps = '';
        jsParamdaad = '';
        jsParamintention = '';
        jsParamq = '';
    }
}

function daadInitStipDbFormActions()
{
    $('#stipdb-submit').click(function() {
        daadFormData.page = 1;
        daadInitCleanupSearchVars(true);
        $('div.stipdb-filters form').trigger('submit');
        return false;
    });
    $('div.stipdb-filters form').submit(function() {
        daadFormData.searchSubmitted = true;
        daadGetResultlist();
        return false;
    });

    $('#reset-form').click(function(e) {
        e.preventDefault();
        $('#i-stichwort').val('');
        $('#s-fach').val('');
        $('#s-land').val('');
        $('#s-status').val('');
        $('#s-vorhaben').val('');
        $('#c-daadonly').removeAttr('checked');
        daadGetResultlist();
    });
}

function daadInitSelectboxes()
{
    var statusRecords = persStatus().order('sortierung');
    statusRecords.each(function(r) {
        var select = $('#s-status');
        select.append(
            '<option value="'+ r.id+'">'+eval('r.name'+langField)+'</option>'
        );
    });
    if (jsParamstatus.length > 0) {
        $('#s-status').val(parseInt(jsParamstatus));
    }

    var sortname = 'name'+langField;
    if (lang == 'de') {
        sortname = 'sortname';
    }
    var originRecords = origin().order(sortname);
    originRecords.each(function(r) {
        var select = $('#s-land');
        select.append(
            '<option value="'+ r.id+'">'+eval('r.name'+langField)+'</option>'
        );
    });
    if (jsParamorigin.length > 0) {
        $('#s-land').val(parseInt(jsParamorigin));
    }

    var subjectGroups = subjectGrps();
    subjectGroups.each(function(r) {
        var select = $('#s-fach');
        select.append(
            '<option value="'+ r.code+'">'+eval('r.name'+langField)+'</option>'
        );
    });
    if (jsParamsubjectGrps.length > 0) {
        $('#s-fach').val(jsParamsubjectGrps);
    }

    var intentions = persIntentions();
    intentions.each(function(r) {
        var select = $('#s-vorhaben');
        select.append(
            '<option value="'+ r.id+'">'+eval('r.name'+langField)+'</option>'
        );
    });
    if (jsParamintention.length > 0) {
        $('#s-vorhaben').val(jsParamintention);
    }


    daadFormData.page = parseInt(jsParampage, 10);
    if (isNaN(daadFormData.page)) {
        daadFormData.page = 1;
    }
}

function daadGetResultlist() {
    if (jsParamdaad.length > 0) {
        $('#c-daadonly').attr('checked', 'checked');
    }

    var filter = {};
    var statusValue = $('#s-status').val();
    if (parseInt(statusValue) > 0) {
        filter.status = {"has": parseInt(statusValue)}
    }
    var countryValue = $('#s-land').val();
    if (parseInt(countryValue) > 0) {
        filter.origin = {"has": parseInt(countryValue)}
    }
    var subjectValue = $('#s-fach').val();
    if (subjectValue.length > 0) {
        filter.subjectGrps = {"has": subjectValue}
    }
    var daadOnly = $('#c-daadonly');
    if (daadOnly.attr('checked') == 'checked') {
        filter.isDaad = {"is": 1}
    }
    var keywordValue = $('#i-stichwort').val();
    if (keywordValue.length > 0) {
        eval('filter.q' + langField + ' = {"like": keywordValue.toLowerCase()}');
    }

    var intentionValue = $('#s-vorhaben').val();
    if (parseInt(intentionValue) > 0) {
        filter.intentions = {"has": parseInt(intentionValue)}
    }

    $('.layout-mobile #reset-form').hide();

    if (Object.keys(filter).length >= 1) {
        $('.layout-mobile #reset-form').show();
    }

    var records = scholarships().filter(filter).order('programmname' + langField);
    daadDisplayPagination(records.count(), daadFormData.epp);
    daadUpdatePaginationListeners(records.count(), daadFormData.epp);

    const $printList = $('.resultlist__print');

    if ($printList.length > 0) {
        records.each(function (r) {
            $printList.append(daadRenderResultRow(r, filter));
        })
    }

    $('span.numScholarships').html(records.count());

    if (records.count() == 1) {
        if (lang == 'de') {
            $('span.scholarshipName').html('Fördermöglichkeit');
        } else if (lang == 'en') {
            $('span.scholarshipName').html('Scholarship option');
        } else {
            $('span.scholarshipName').html('Posibilidad de promoción');
        }

    }

    var start = ((daadFormData.page - 1) * daadFormData.epp);

    if (daadFormData.page > 1) {
        start += 1;
    }

    var records = scholarships().filter(filter).order('sorting desc, isDaad desc, programmname' + langField + ' ').limit(daadFormData.epp).start(start);
    var list = $('div.stipdb-results ul.resultlist');

    list.find('li').remove();

    records.each(function (r) {
        list.append(daadRenderResultRow(r, filter));
    });

    daadInitStipDbTooltip();

    linkParams = createLinkParams(filter, langField, daadFormData.page);
    linkParams.push('back=1');

    if (daadFormData.searchSubmitted == true || daadSearchAfterNavigationHappened == true) {
        pushSearchParamsToUrlForBackLink(linkParams);
    }

    setPrintAndPdfUrl(linkParams)
    trackSearch(linkParams)
}

function pushSearchParamsToUrlForBackLink(linkParams)
{
    var uri = window.location.href.split('/?');
    var newUri = uri[0] + '/?' + linkParams.join('&');
    newUri = newUri.replace('//?', '/?');
    history.pushState('', '', newUri);
}

function setPrintAndPdfUrl(linkParams)
{
    var uri = window.location.href.split('/?')
    var pdfUrl = uri[0] + '.pdf?' + linkParams.join('&') + '&runJs=1&refreshPdfAfter=5'
    var printUrl = uri[0] + '/?' + linkParams.join('&') + '&type=print'
    printUrl = printUrl.replace('//?', '/?')
    $('.page-format li a').attr('href', pdfUrl)
    $('.page-format .print a').attr('href', printUrl)
}

function createLinkParams(filter, langField, page)
{
    var linkParams = [];
    if (typeof filter.status != 'undefined') {
        linkParams.push('status='+filter.status.has);
    } else {
        linkParams.push('status=');
    }
    if (typeof filter.origin != 'undefined') {
        linkParams.push('origin='+filter.origin.has);
    } else {
        linkParams.push('origin=');
    }
    if (typeof filter.subjectGrps != 'undefined') {
        linkParams.push('subjectGrps='+filter.subjectGrps.has);
    } else {
        linkParams.push('subjectGrps=');
    }

    if (typeof filter.isDaad != 'undefined') {
        linkParams.push('daad='+filter.isDaad.is);
    } else {
        linkParams.push('daad=');
    }

    if (typeof filter.intentions != 'undefined') {
        linkParams.push('intention='+filter.intentions.has);
    } else {
        linkParams.push('intention=');
    }

    if (typeof eval('filter.q'+langField) != 'undefined') {
        linkParams.push('q='+eval('filter.q'+langField+'.like'));
    } else {
        linkParams.push('q=');
    }

    linkParams.push('page='+page);

    return linkParams;
}

function daadRenderResultRow(r, filter)
{
    var statusLabel = '---';
    if (r.status.length > 0) {
        statusLabel = ''
        var statusRecords = persStatus({id: r.status}).order('sortierung');

        statusRecords.each(function(record) {
            if (statusLabel.length > 0) {
                statusLabel+= ', ';
            }
            statusLabel+= eval('record.name'+langField);
        });
    }

    if (r.subjectGrps.length > 0) {
        var sgList = $('<ul></ul>');
        for(var i = 0; i < r.subjectGrps.length; ++i) {
            var g = r.subjectGrps[i];
            if (typeof g == 'string') {
                var sRecord = subjectGrps({code: g});
                if (sRecord.count() > 0) {
                    sRecord = sRecord.first();
                    sgList.append('<li>'+eval('sRecord.name'+langField)+'</li>')
                }
            }
        }
    }

    if (r.isDaad == 1) {
        var isDaad = $('<span/>');
        isDaad.html('<span>&nbsp;• DAAD</span>');
    } else {
        var isDaad = $('<span>&nbsp;</span>');
    }

    linkParams = createLinkParams(filter, langField, daadFormData.page);
    linkParams.push('lang='+lang);
    linkParams.push('sd=1');
    linkParams.push('detail='+ r.sapProgid);
    linkParams.push('page='+daadFormData.page)
    var link = basicLink+'?'+linkParams.join('&amp;');

    var wrap = $('<li class="entry clearfix"></li>');
    wrap.append('<h2>'+
        '<a href="'+link+'">'+ eval('r.programmname'+langField) +isDaad.html()+'</a>'+
        '</h2>'+
        '<div class="row clearfix">'+
        '<div class="col">'+
        '<dl>'+
        '<dt><img class="list-icon" src="/bundles/daadimperia/pics/single-neutral-actions.svg" alt="" width="18" height="18">'+translations['status'][lang]+':</dt>'+
        '<dd>'+statusLabel+'&nbsp;</dd>'+
        '<dt><img class="list-icon" src="/bundles/daadimperia/pics/pin-icon.svg" alt="" width="18" height="18">'+translations['herkunftsland'][lang]+':</dt>'+
        '<dd>'+translations['nurbestimmte'][lang]+' '+
        '<div class="info-icon-wrapper">' +
        '<i class="info-icon"></i>'+
        '<div class="tool-tip-stipdb tool-tip-land">'+
        '<p>'+translations['tooltippherkunftsland'][lang]+'</p>'+
        '</div>'+
        '</div>'+
        '</dd>'+
        '<dt><img class="list-icon" src="/bundles/daadimperia/pics/book-open.svg" alt="" width="18" height="18">'+translations['fachrichtung'][lang]+':</dt>'+
        '<dd>'+translations['sieheliste'][lang]+' '+
        '<div class="info-icon-wrapper">' +
        '<i class="info-icon"></i>'+
        '<div class="tool-tip-stipdb">'+
        '<p>'+translations['tooltippfachrichtung'][lang]+':</p><ul>'+sgList.html()+'</ul>'+
        '</div>'+
        '</div>'+
        '</dd>'+
        '</dl>'+
        '</div>'+
        '<div class="col">'+
        '<p class="entry-detail">'+ eval('r.introduction.'+lang) + '...</p>'+
        '</div>'+
        '</div>'+
        '<div class="entry-arrow">'+
        '<a href="'+link+'">'+ eval('r.programmname'+langField) +isDaad.html()+'</a>'+
        '</div>'+
        daadProgrammeDeadline(r, filter, lang)+
        '</li>'
    );

    return wrap;
}

function daadProgrammeDeadline(row, filter, lang)
{
    var deadlineResult = listDeadlines({ 'id': row.sapProgid });

    if (0 === deadlineResult.count() || 'undefined' == typeof filter.origin) {
        return '';
    }

    var record = deadlineResult.first();

    var countryId = filter.origin.has;
    var text = '';

    if ('undefined' !== typeof record.general[lang] && 0 < record.general[lang].length) {
        text = '<!-- g -->' + record.general[lang];
    }

    if ('undefined' !== typeof record.countries[countryId]  && 0 < record.countries[countryId].length) {
        $(record.countries[countryId]).each(function () {
            if (text.length > 0) {
                text = text + '<br /><br />' + this[lang];
            } else {
                text = '<!-- l -->' + this[lang];
            }
        });
    }

    if (! text) {
        return '';
    }

    return '<div class="row clearfix">' +
        '<div class="application-deadline-wrapper col-12">' +
        '<dl>' +
        '<dt><img class="list-icon" src="/bundles/daadimperia/pics/deadline.svg" alt="" width="20" height="20">' + translations['deadline'][lang] + ':</dt>'+
        '<dd>' + text+'</dd>' +
        '</dl>' +
        '</div>' +
        '</div>';
}

function daadSubmitSearch()
{
    $('div.stipdb-filters form').submit();
}

function daadDisplayPagination(numElements, epp)
{
    $('ul.pagination').children().remove();

    var numPages = Math.ceil(numElements / epp);
    if (numPages <= 1) {
        return;
    }

    var output = '';

    output += '<li><a';
    if (daadFormData.page == 1) {
        output += ' class="disabled"';
    }
    output += ' href="#">‹</a></li>';

    var pagesToShow = [];
    for (var i=1; i<=numPages; i++) {
        if (i < 4) {
            pagesToShow.push(i);
        }
        if (i == daadFormData.page && i>2 && (i<numPages-1)) {
            if ($.inArray(i-1, pagesToShow) == -1) {
                pagesToShow.push(i-1);
            }
            if ($.inArray(i, pagesToShow) == -1) {
                pagesToShow.push(i);
            }
            if ($.inArray(i+1, pagesToShow) == -1) {
                pagesToShow.push(i+1);
            }
        }
        if (i > numPages-3) {
            if ($.inArray(i, pagesToShow) == -1) {
                pagesToShow.push(i);
            }
        }
    }

    for (i=0; i<pagesToShow.length; i++) {
        if (pagesToShow[i] == daadFormData.page) {
            output += '<li class="hidden-l hidden-m hidden-s"><a class="current" href="#">' + pagesToShow[i] + '</a></li>';
        } else {
            output += '<li class="hidden-l hidden-m hidden-s"><a href="#">' + pagesToShow[i] + '</a></li>';
        }
        if (i<pagesToShow.length-1 && pagesToShow[i+1] != (pagesToShow[i]+1)) {
            output += '<li class="hidden-l hidden-m hidden-s"><a class="disabled" href="#">...</a></li>';
        }
    }
    output += '<li><a';
    if (daadFormData.page == numPages) {
        output += ' class="disabled"';
    }
    output += ' href="#">›</a></li>';

    $('ul.pagination').html(output);
}

function daadUpdatePaginationListeners(numElements, epp)
{
    $('ul.pagination li a').click(function() {
        if ($(this).hasClass('disabled')) {
            return false;
        }
        var numPages = Math.ceil(numElements / epp);
        var numClicked = $(this).html();
        if (numClicked == '«') {
            daadFormData.page = 1;
        } else if (numClicked == '»') {
            daadFormData.page = daadFormData.page = numPages;
        } else if (numClicked == '‹') {
            daadFormData.page = daadFormData.page - 1;
        } else if (numClicked == '›') {
            daadFormData.page = daadFormData.page + 1;
        } else {
            daadFormData.page = Math.round(numClicked);
        }
        daadSearchAfterNavigationHappened = true;
        daadSubmitSearch(true);

        $('html, body').animate({scrollTop:0}, 'fast');

        return false;
    });
}

function daadInitTabs()
{
    daadShowHidePrintButton('hide');

    $('#programTab a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
    });

    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        daadToggleStipdbTabEvent(e);
    });

    $('a[data-toggle="tab"]').on('shown', function (e) {
        daadToggleStipdbTabEvent(e);
    });

    var urlTabMatch = window.location.href.toString();

    if(urlTabMatch.indexOf('#') >= 0) {
        urlTabMatch = urlTabMatch.replace(/.*\#/, "");
    } else {
        urlTabMatch = '';
    }

    if (urlTabMatch.length > 0) {
        changeTab(urlTabMatch);
    }

    $('#herkunft').popover();
    $('#fachrichtung').popover();
}

function daadToggleStipdbTabEvent(e)
{
    if (e.target.toString().match(/voraussetzungen/)) {
        $('#weitere-voraussetzungen').hide();
    } else {
        $('#weitere-voraussetzungen').show();
    }

    if (e.target.toString().match(/bewerbung/)) {
        $('.layout-mobile .hint-mobile-device').removeClass('hidden-l');
        $('.layout-mobile .hint-mobile-device').removeClass('hidden-m');
        $('.layout-mobile .hint-mobile-device').removeClass('hidden-s');
    } else {
        $('.layout-mobile .hint-mobile-device').addClass('hidden-l');
        $('.layout-mobile .hint-mobile-device').addClass('hidden-m');
        $('.layout-mobile .hint-mobile-device').addClass('hidden-s');
    }

    if ($('#select-application-info').length == 0) {

        if (e.target.toString().match(/ueberblick/)) {
            daadShowHidePrintButton('hide');
        } else {
            daadShowHidePrintButton('show');
        }

        return
    }

    if (e.target.toString().match(/hinweise/)) {
        $('#select-application-info').show();
        $('#ifa-stipendien-detail .page-container').hide();
        $('#cd-ref').val(e.target.toString().replace(/.*\#/, ""));
        daadInitSelectLayerCaptions($('#cd-ref').val());
        daadInitStipDbForm(currentViewport);
    } else if (e.target.toString().match(/voraussetzung/)) {
        $('#select-application-info').show();
        $('#ifa-stipendien-detail .page-container').hide();
        $('#cd-ref').val(e.target.toString().replace(/.*\#/, ""));
        daadInitSelectLayerCaptions($('#cd-ref').val());
        daadInitStipDbForm(currentViewport);
    } else if (e.target.toString().match(/prozess/)) {
        $('#select-application-info').show();
        $('#ifa-stipendien-detail .page-container').hide();
        $('#cd-ref').val(e.target.toString().replace(/.*\#/, ""));
        daadInitSelectLayerCaptions($('#cd-ref').val());
        daadInitStipDbForm(currentViewport);
    } else if (e.target.toString().match(/bewerbung/)) {
        $('#select-application-info').show();
        $('#ifa-stipendien-detail .page-container').hide();
        $('#cd-ref').val(e.target.toString().replace(/.*\#/, ""));
        $('.layout-mobile .hint-mobile-device').removeClass('hidden');
        daadInitSelectLayerCaptions($('#cd-ref').val());
        daadInitStipDbForm(currentViewport);
    } else if (e.target.toString().match(/kontaktberatung/)) {
        $('#select-application-info').show();
        $('#ifa-stipendien-detail .page-container').hide();
        $('#cd-ref').val(e.target.toString().replace(/.*\#/, ""));
        daadInitSelectLayerCaptions($('#cd-ref').val());
        daadInitStipDbForm(currentViewport);
    } else {
        $('#ifa-stipendien-detail .page-container').show();
        $('#select-application-info').hide();
    }
}

function daadInitSelectLayerCaptions(identifier)
{
    if (typeof layerCaptions[identifier] != 'undefined') {
        $('#select-application-info h3 span').html(layerCaptions[identifier]['headline']);
        $('#select-application-info #stipdb-submit-detail').val(layerCaptions[identifier]['button']);
    }
}

function extractCountryId()
{
    var params = window.location.href.split('&');
    var countryId = 0;

    for (i=0; i < params.length; ++i) {
        if (params[i].match(/land=/)) {
            countryId = params[i].replace(/[^0-9]+/, '');
        }
    }

    return parseInt(countryId);
}

function changeTab(id)
{
    $('html, body').animate({scrollTop:0}, 'fast');
    $("#programTab a."+id).tab('show');

    if (id == 'voraussetzungen') {
        $('#weitere-voraussetzungen').hide();
    } else {
        $('#weitere-voraussetzungen').show();
    }
}

function daadToggleAccordeon(id)
{
    changeTab(id);
}

function daadInitApplicationButton()
{
    var form = $('#bewerbung').find('form');

    if (form.length > 0) {
        if (jsParamorigin.length > 0 && jsParamdetail.length > 0) {
            var filter = {};
            filter.sapProgid = {"is": parseInt(jsParamdetail)}
            filter.countryId = {"is": parseInt(jsParamorigin)}
        }

        form.find('button').each(function() {
            $(this).attr('rel', $(this).attr('rel'));
        });

        form.find('button').click(function() {
            var params = $(this).attr('rel').split('-');

            if (params[5] == 'SAP_SCP') {
                var link = 'https://funding.meindaad.de/sites/personalfunding#PBFApplication-Start?';
                link+= 'fundingProgramInstance='+params[1];
                link+= '&originCountry='+params[2];
                link+= '&targetCountry='+params[4];
                link+= '&targetGroup='+params[3];
            }  else {
                var link = 'https://portal.daad.de/sap/bc/bsp/sap/z_set_cookie/setcookie.htm?fund_ar=stv';
                link+= '&langb='+params[2];
                link+= '&id='+params[1];
                link+= '&persk='+params[3];
                link+= '&lziel='+params[4];
            }

            var newwindow = window.open(link);

            return false;
        });
    }
}

function daadInitStipDbTooltip() {
    var tooltipOpen = false;

    $('html').click(function(){
        if (tooltipOpen == true){
            $('.tool-tip-stipdb').hide();
            $('#herkunft').popover('hide');
            $('#fachrichtung').popover('hide');
            $('.layout-mobile #fader').addClass('hidden');
            tooltipOpen = false;
        }
    });

    $('.layout-mobile #fader').click(function(){
        if (tooltipOpen == true){
            $('.tool-tip-stipdb').hide();
            $('#herkunft').popover('hide');
            $('#fachrichtung').popover('hide');
            $('.layout-mobile #fader').addClass('hidden');
            tooltipOpen = false;
        }
    });

    $('.info-icon').click(function(event){
        event.stopPropagation();
        $('.tool-tip-stipdb').hide();
        $(this).parent().find('.tool-tip-stipdb').show();
        $('.layout-mobile #fader').addClass('hidden');

        var bodyViewport = $('body').attr('current-scholarship-viewport');

        if (bodyViewport == 'm') {
            $('.layout-mobile #fader').removeClass('hidden');
        }

        if (bodyViewport == 's') {
            $('.layout-mobile #fader').removeClass('hidden');
        }

        tooltipOpen = true;

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'stipdb-info-icon-click'
        });
    });
}

function daadInitStipDbForm(viewport) {

    var config = {
        '.stipdb-filters .chzn-select-deselect'  : {
            allow_single_deselect:true,
            disable_search_threshold: 40
        },
        '.chzn-select' : {
            disable_search_threshold: 40
        },
        '#select-application-info-form .chzn-select-deselect'  : {
            allow_single_deselect:true,
            disable_search_threshold: 40
        }
    }

    for (var selector in config) {
        if (!viewport) {
            $(selector).chosen(config[selector]);
        }

        if (viewport == 'l') {
            $('.chzn-select-deselect option:first-child').text('');
            $(selector).chosen(config[selector]);
        }

        if (viewport == 'm' || viewport == 's') {
            $('.chzn-container').remove();
            $('.chzn-done').removeAttr('style');
            $('.chzn-done').removeClass('chzn-done');
            $('.chzn-select-deselect').each(function(){
                var placeholder = $(this).attr('data-placeholder');
                $(this).find('option:first-child').text(placeholder);
            });
        }
    }
}

function daadInitYourSelection()
{
    var wrap = $('div.your-choice span.selection');
    var selection = '';

    if (jsParamstatusName.length > 0 || jsParamsubjectGrpsName.length > 0) {
        if (lang == 'de') {
            selection = '• Ihre Auswahl: Förderprogramme';
        } else if (lang == 'en') {
            selection = '• Your selection: Scholarship programmes';
        } else {
            selection = '• Su elección: Programas de apoyo';
        }
    }

    if (jsParamstatusName.length > 0) {
        if (lang == 'de') {
            selection+= '&nbsp;für <strong>'+jsParamstatusName+'</strong>';
        } else if (lang == 'en') {
            selection+= '&nbsp;for <strong>'+jsParamstatusName+'</strong>';
        } else {
            selection+= '&nbsp;para <strong>'+jsParamstatusName+'</strong>';
        }
    }

    if (jsParamsubjectGrpsName.length > 0) {
        if (lang == 'de') {
            selection+= '&nbsp;in der <strong>Fachrichtung '+jsParamsubjectGrpsName+'</strong>';
        } else if (lang == 'en') {
            selection+= '&nbsp;with the <strong>discipline '+jsParamsubjectGrpsName+'</strong>';
        } else {
            selection+= '&nbsp;con la <strong>especialidad '+jsParamsubjectGrpsName+'</strong>';
        }
    }

    if (jsParamoriginName.length > 0) {
        if (lang == 'de') {
            selection+= '&nbsp;mit dem <strong>Land '+jsParamoriginName+'</strong>';
        } else if (lang == 'en') {
            selection+= '&nbsp;with the <strong>country '+jsParamoriginName+'</strong>';
        } else {
            selection+= '&nbsp;con el <strong>país de procedencia '+jsParamoriginName+'</strong>';
        }
    }

    if (jsParamintentionName.length > 0) {
        if (lang == 'de') {
            selection+= '&nbsp;mit dem <strong>Vorhaben '+jsParamintentionName+'</strong>';
        } else if (lang == 'en') {
            selection+= '&nbsp;with the <strong>intention '+jsParamintentionName+'</strong>';
        } else {
            selection+= '&nbsp;con el <strong>intention '+jsParamintentionName+'</strong>';
        }
    }

    wrap.html(selection);
}

function daadInitTargetCountrySelection ()
{
    if ($('.target-country-selection').length > 0) {
        var selectionBox = $('.target-country-selection').find('select');

        if (location.href.match(/stb/)) {
            $('html, body').animate({
                scrollTop: $(".target-country-selection").offset().top
            }, 1);
        }

        selectionBox.change(function() {
            if (parseInt($(this).val()) > 0) {
                $('.info-form').find('ul.instances').html('<li>'+translations['loading'][lang]+'</li>');

                var linkParams = new Array();
                linkParams.push('status=' + jsParamstatus);
                linkParams.push('origin=' + jsParamorigin);
                linkParams.push('subjectGrps=' + jsParamsubjectGrps);
                linkParams.push('daad=' + jsParamdaad);
                linkParams.push('q=' + jsParamq);
                linkParams.push('page=' + jsParampage);
                linkParams.push('detail=' + jsParamdetail);
                linkParams.push('target=' + parseInt($(this).val()));
                linkParams.push('stb=1');

                var link = basicLink + '?' + linkParams.join('&')+'#bewerbung';

                window.location.href = link;
            } else {
                $('.info-form').find('ul.instances').html('');
            }
        });
    }

}

/**
 * LinkParams structure:
 * [0] status
 * [1] origin
 * [2] subjectGrps
 * [3] daad
 * [4] intention
 * [5] q
 * [6] page
 * [7] back
 *
 * @param array linkParams
 */
function trackSearchGa4(linkParams) {
    const items = []

    // Searchterm
    const searchTerm = getValueFromLinkParams(linkParams, 5)
    items.push(['Suchbegriff', searchTerm])

    // DAAD only
    const isDaadOnly = !! getValueFromLinkParams(linkParams, 4)
    items.push(['Nur DAAD Förderangebote', isDaadOnly ? 'Ja' : 'Nein'])

    const fields = [
        { id: 'status', label: 'Programme für', index: 0 },
        { id: 'land', label: 'Land', index: 1 },
        { id: 'fach', label: 'Fachrichtung', index: 2 },
        { id: 'vorhaben', label: 'Vorhaben', index: 4 },
    ]

    let trackingData = {
        event: 'stipdb-auslaender-search-ga4',
    }

    fields.forEach((field) => {
        const value = getValueFromLinkParams(linkParams, field.index)
        let label = getLabelBySelectValue($(`#s-${field.id}`), value)

        /**
         * Es ist sowohl "-- keine Einschränkung --" als auch "--  keine Einschränkung  --" im Einsatz,
         * daher prüfen wir hier nur auf den entscheidenden String "keine Einschränkung" und das englische Pendant.
         */
        if (label.indexOf('keine Einschränkung') >= 0 || label.indexOf('No restriction') >= 0) {
            label = ''
        }

        trackingData[field.id] = label.trim()
    })

    console.log('GA4 TRACKING DEBUG', trackingData)

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(trackingData);
}

/**
 * LinkParams structure:
 * [0] status
 * [1] origin
 * [2] subjectGrps
 * [3] daad
 * [4] intention
 * [5] q
 * [6] page
 * [7] back
 *
 * @param array linkParams
 */
function trackSearch(linkParams) {
    const items = []

    // Searchterm
    const searchTerm = getValueFromLinkParams(linkParams, 5)
    items.push(['Suchbegriff', searchTerm])

    // DAAD only
    const isDaadOnly = !! getValueFromLinkParams(linkParams, 3)
    items.push(['Nur DAAD Förderangebote', isDaadOnly ? 'Ja' : 'Nein'])

    const fields = [
        { id: 'status', label: 'Programme für' },
        { id: 'land', label: 'Land' },
        { id: 'fach', label: 'Fachrichtung' },
        null,
        { id: 'vorhaben', label: 'Vorhaben' },
    ]

    fields.forEach((field, index) => {
        if (!field) return

        const value = getValueFromLinkParams(linkParams, index)
        let label = getLabelBySelectValue($(`#s-${field.id}`), value)

        /**
         * Es ist sowohl "-- keine Einschränkung --" als auch "--  keine Einschränkung  --" im Einsatz,
         * daher prüfen wir hier nur auf den entscheidenden String "keine Einschränkung" und das englische Pendant.
         */
        if (label.indexOf('keine Einschränkung') >= 0 || label.indexOf('No restriction') >= 0) {
            label = ''
        }

        items.push([field.label, label])
    })

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        'event': 'stipdb-auslaender-search',
        'data': toGtmDataString(items),
    });

    trackSearchGa4(linkParams)
}

/**
 * @example
 *
 * getValueFromLinkParams([
 *     0: 'id=',
 *     1: 'status=Graduierte',
 * ], 1)
 * // returns "Graduierte"
 *
 * @param array linkParams
 * @param number index
 *
 * @return string
 */
function getValueFromLinkParams (linkParams, index)
{
    return linkParams[index].split('=')[1]
}

/**
 * Get an option label by value
 *
 * @param jQuery Element $select
 * @param mixed value
 * @returns string
 */
function getLabelBySelectValue ($select, value)
{
    return $select.find(`option[value="${value}"]`).text()
}

/**
 * Convert data of a form to a readable string for tracking.
 *
 * @sig [String, String | [String] ] -> String
 * @example
 *
 * toDataString([
 *     [ 'Interests', [ 'Dancing', 'Singing' ]  ],
 *     [ 'Degree', 'Master' ],
 *     [ 'Subject', [ 'Math', 'Bwl' ]  ],
 * ])
 * // returns 'Interests [DANCING; SINGING] ► Degree [MASTER] ► Subject [MATH; BWL]'
 */
function toGtmDataString (arrayOrString) {
    arrayOrString = arrayOrString.map(item => {
        const label = item[0] || ''

        let values = item[1] || []
        if (typeof values === 'string') {
            values = [values]
        }

        values = values.map(x => x.toUpperCase())

        return `${label} [${values.join('; ')}]`
    })

    return arrayOrString.join(' ► ')
}

var translations = new Array();
translations['status'] = new Array();
translations['status']['de'] = 'Status';
translations['status']['en'] = 'Status';
translations['status']['es'] = 'estatus';
translations['herkunftsland'] = new Array();
translations['herkunftsland']['de'] = 'Land';
translations['herkunftsland']['en'] = 'Country';
translations['herkunftsland']['es'] = 'país de procedencia';
translations['fachrichtung'] = new Array();
translations['fachrichtung']['de'] = 'Fachrichtung';
translations['fachrichtung']['en'] = 'Subject';
translations['fachrichtung']['es'] = 'materia';
translations['nurbestimmte'] = new Array();
translations['nurbestimmte']['de'] = 'nur bestimmte';
translations['nurbestimmte']['en'] = 'Only specified';
translations['nurbestimmte']['es'] = 'solo algunos(as)';
translations['sieheliste'] = new Array();
translations['sieheliste']['de'] = 'siehe Liste';
translations['sieheliste']['en'] = 'See list';
translations['sieheliste']['es'] = 'solo algunos(as)';
translations['tooltippherkunftsland'] = new Array();
translations['tooltippherkunftsland']['de'] = 'Die Förderung durch dieses Programm ist auf bestimmte Länder beschränkt. Erläuterungen dazu finden Sie auf der Detailseite des Förderprogramms unter den Bewerbungsvoraussetzungen.';
translations['tooltippherkunftsland']['en'] = 'The scholarship for this programme is restricted to certain countries. You can find an explanation for this on the details page of the scholarship programme under the application requirements.';
translations['tooltippherkunftsland']['es'] = 'La promoción a través de este programa está limitada a determinados países de origen. Encontrará las aclaraciones correspondientes en la página de datos del programa de apoyo, en los requisitos para la solicitud.';
translations['tooltippfachrichtung'] = new Array();
translations['tooltippfachrichtung']['de'] = 'Gilt für folgende Fachrichtungen';
translations['tooltippfachrichtung']['en'] = 'Applicable to the following disciplines';
translations['tooltippfachrichtung']['es'] = 'Limitado a las siguientes especialidades';
translations['loading'] = new Array();
translations['loading']['de'] = 'Wird geladen...';
translations['loading']['en'] = 'Loading...';
translations['deadline'] = new Array();
translations['deadline']['de'] = 'Bewerbungsschluss';
translations['deadline']['en'] = 'Application deadline';
translations['deadline']['es'] = '';
