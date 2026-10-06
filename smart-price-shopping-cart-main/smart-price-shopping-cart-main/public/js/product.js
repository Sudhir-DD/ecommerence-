/* Product page: price trend chart, smart price alert panel, AI price prediction. */
(function () {
    'use strict';

    var P = window.PRODUCT;
    var FORECAST_DAYS = 28;
    var state = { days: 90, data: null, previewTarget: null, dirty: false };
    var debounceTimer = null;

    var lakhFormat = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 2 });

    function $(id) {
        return document.getElementById(id);
    }

    function money(n) {
        return '₹' + Math.round(n).toLocaleString('en-IN');
    }

    function axisMoney(n) {
        return n >= 100000 ? '₹' + lakhFormat.format(n) : money(n);
    }

    function pct(n, digits) {
        return Math.abs(n).toFixed(digits === undefined ? 1 : digits) + '%';
    }

    function addDays(dateStr, days) {
        var d = new Date(dateStr + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
    }

    function shortDate(dateStr) {
        return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC'
        });
    }

    function roundStep(v) {
        var step = v >= 100000 ? 100 : v >= 10000 ? 10 : 1;
        return Math.max(step, Math.round(v / step) * step);
    }

    function clamp(v, lo, hi) {
        return Math.min(Math.max(v, lo), hi);
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function directionArrow(change) {
        if (Math.abs(change) < 0.05) return { cls: 'flat', arrow: '●' };
        return change < 0 ? { cls: 'down', arrow: '▼' } : { cls: 'up', arrow: '▲' };
    }

    /* ---------- header: price, 30-day change, verdict ---------- */

    function renderHeader(data) {
        $('pdPrice').textContent = money(data.product.price);

        var change = data.stats.change30Pct;
        var d = directionArrow(change);
        var pill = $('pdDelta');
        pill.hidden = false;
        pill.className = 'delta-pill delta-' + d.cls;
        pill.textContent = d.arrow + ' ' + (d.cls === 'flat' ? 'Flat' : pct(change)) + ' vs 30 days ago';

        var verdict = $('pdVerdict');

        if (data.verdict) {
            var labels = { buy: 'Good time to buy', wait: 'Consider waiting', fair: 'Fair price' };
            verdict.hidden = false;
            verdict.className = 'verdict verdict-' + data.verdict.level;
            verdict.innerHTML = '<strong>' + labels[data.verdict.level] + '</strong><span>' + data.verdict.message + '</span>';
        } else {
            verdict.hidden = true;
        }
    }

    /* ---------- chart ---------- */

    function drawChart(data) {
        var host = $('chart');
        var hist = data.history;
        var pred = data.prediction;

        if (!hist.length) {
            host.innerHTML = '<p class="muted chart-loading">No price history yet.</p>';
            return;
        }

        var fc = pred ? pred.points.slice(0, FORECAST_DAYS) : [];
        var target = pred && pred.target ? pred.target.price : null;
        var lastDate = hist[hist.length - 1].date;

        var W = 760;
        var H = 340;
        var m = { l: 76, r: 24, t: 24, b: 40 };
        var iw = W - m.l - m.r;
        var ih = H - m.t - m.b;
        var n = hist.length;

        var xmin = -(n - 1);
        var xmax = fc.length ? FORECAST_DAYS : 0;

        if (xmax === xmin) xmax = xmin + 1;

        var values = hist.map(function (p) { return p.price; });
        fc.forEach(function (p) { values.push(p.price); });
        if (target) values.push(target);

        var lo = Math.min.apply(null, values);
        var hi = Math.max.apply(null, values);
        var pad = (hi - lo) * 0.1 || hi * 0.05;
        var ymin = Math.max(0, lo - pad);
        var ymax = hi + pad;

        function X(d) { return m.l + ((d - xmin) / (xmax - xmin)) * iw; }
        function Y(v) { return m.t + (1 - (v - ymin) / (ymax - ymin)) * ih; }
        function pts(list) {
            return list.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
        }

        var base = m.t + ih;
        var histPts = hist.map(function (p, i) { return [X(i - (n - 1)), Y(p.price)]; });
        var lastPt = histPts[histPts.length - 1];
        var svg = '';

        svg += '<defs>' +
            '<linearGradient id="gLine" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#0284c7"/></linearGradient>' +
            '<linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity="0.22"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient>' +
            '</defs>';

        for (var i = 0; i <= 4; i++) {
            var v = ymin + ((ymax - ymin) * i) / 4;
            svg += '<line class="grid-line" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
            svg += '<text class="axis-label" x="' + (m.l - 10) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + axisMoney(v) + '</text>';
        }

        for (var k = 0; k <= 5; k++) {
            var d = Math.round(xmin + ((xmax - xmin) * k) / 5);
            var anchor = k === 0 ? 'start' : k === 5 ? 'end' : 'middle';
            svg += '<text class="axis-label" x="' + X(d).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="' + anchor + '">' + shortDate(addDays(lastDate, d)) + '</text>';
        }

        svg += '<path class="hist-area" d="M' + pts(histPts) + ' L' + lastPt[0].toFixed(1) + ',' + base + ' L' + histPts[0][0].toFixed(1) + ',' + base + ' Z"/>';

        if (fc.length) {
            var upper = [[lastPt[0], lastPt[1]]].concat(fc.map(function (p) { return [X(p.day), Y(clamp(p.high, ymin, ymax))]; }));
            var lower = [[lastPt[0], lastPt[1]]].concat(fc.map(function (p) { return [X(p.day), Y(clamp(p.low, ymin, ymax))]; })).reverse();
            var mid = [[lastPt[0], lastPt[1]]].concat(fc.map(function (p) { return [X(p.day), Y(p.price)]; }));

            svg += '<path class="fc-band" d="M' + pts(upper.concat(lower)) + ' Z"/>';
            svg += '<path class="fc-line" d="M' + pts(mid) + '"/>';
            svg += '<line class="today-line" x1="' + X(0).toFixed(1) + '" x2="' + X(0).toFixed(1) + '" y1="' + m.t + '" y2="' + base + '"/>';
            svg += '<text class="axis-label today-label" x="' + (X(0) - 6).toFixed(1) + '" y="' + (m.t + 10) + '" text-anchor="end">Today</text>';
            svg += '<text class="axis-label fc-label" x="' + (X(0) + 6).toFixed(1) + '" y="' + (m.t + 10) + '" text-anchor="start">AI prediction</text>';
        }

        if (target) {
            var ty = Y(target).toFixed(1);
            svg += '<line class="target-line" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + ty + '" y2="' + ty + '"/>';
            svg += '<text class="target-label" x="' + (W - m.r) + '" y="' + (Y(target) - 7).toFixed(1) + '" text-anchor="end">Target ' + money(target) + '</text>';
        }

        svg += '<path class="hist-line" d="M' + pts(histPts) + '"/>';
        svg += '<circle class="today-dot" cx="' + lastPt[0].toFixed(1) + '" cy="' + lastPt[1].toFixed(1) + '" r="5"/>';
        svg += '<line class="guide" id="chartGuide" y1="' + m.t + '" y2="' + base + '" opacity="0"/>';
        svg += '<circle class="guide-dot" id="chartGuideDot" r="5" opacity="0"/>';
        svg += '<rect class="hover-rect" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '"/>';

        host.innerHTML =
            '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Price history and forecast for ' + P.name + '">' + svg + '</svg>' +
            '<div class="chart-tip" id="chartTip" hidden></div>';

        var svgEl = host.querySelector('svg');
        var tip = $('chartTip');
        var guide = $('chartGuide');
        var guideDot = $('chartGuideDot');

        function hide() {
            tip.hidden = true;
            guide.setAttribute('opacity', '0');
            guideDot.setAttribute('opacity', '0');
        }

        function show(e) {
            var rect = svgEl.getBoundingClientRect();
            var vx = ((e.clientX - rect.left) / rect.width) * W;

            if (vx < m.l || vx > W - m.r) {
                hide();
                return;
            }

            var day = Math.round(xmin + ((vx - m.l) / iw) * (xmax - xmin));
            day = clamp(day, xmin, fc.length ? FORECAST_DAYS : 0);

            var point;
            var html;

            if (day > 0) {
                point = fc[day - 1];
                html = '<b>' + shortDate(point.date) + ' · AI forecast</b><span>' + money(point.price) + '</span><small>' + money(point.low) + ' – ' + money(point.high) + '</small>';
            } else {
                point = hist[n - 1 + day];
                html = '<b>' + shortDate(point.date) + '</b><span>' + money(point.price) + '</span>';
            }

            var px = X(day);
            var py = Y(point.price);

            guide.setAttribute('x1', px);
            guide.setAttribute('x2', px);
            guide.setAttribute('opacity', '1');
            guideDot.setAttribute('cx', px);
            guideDot.setAttribute('cy', py);
            guideDot.setAttribute('opacity', '1');
            guideDot.setAttribute('class', 'guide-dot' + (day > 0 ? ' forecast' : ''));

            tip.innerHTML = html;
            tip.hidden = false;
            tip.style.left = clamp((px / W) * rect.width, 70, rect.width - 70) + 'px';
            tip.style.top = (py / H) * rect.height + 'px';
        }

        svgEl.addEventListener('pointermove', show);
        svgEl.addEventListener('pointerdown', show);
        svgEl.addEventListener('pointerleave', hide);

        renderLegend(!!fc.length, !!target);
    }

    function renderLegend(hasForecast, hasTarget) {
        var html = '<span class="lg lg-hist">Price history</span>';

        if (hasForecast) html += '<span class="lg lg-fc">AI prediction</span>';
        if (hasTarget) html += '<span class="lg lg-target">Target</span>';

        $('chartLegend').innerHTML = html;
    }

    /* ---------- stats ---------- */

    function renderStats(data) {
        var s = data.stats;
        var vsAvg = ((s.current - s.avg) / s.avg) * 100;

        var tiles = [
            ['Current', money(s.current), s.vsLowPct <= 0.05 ? 'At the low' : pct(s.vsLowPct) + ' above low'],
            ['Lowest', money(s.min), shortDate(s.minDate)],
            ['Highest', money(s.max), shortDate(s.maxDate)],
            ['Average', money(s.avg), Math.abs(vsAvg) < 0.05 ? 'At average' : pct(vsAvg) + (vsAvg < 0 ? ' below avg' : ' above avg')]
        ];

        $('statsRow').innerHTML = tiles
            .map(function (t) {
                return '<div class="stat"><span class="stat-label">' + t[0] + '</span><strong>' + t[1] + '</strong><span class="stat-sub">' + t[2] + '</span></div>';
            })
            .join('');
    }

    /* ---------- AI prediction panel ---------- */

    function renderAi(data) {
        var pred = data.prediction;
        var body = $('aiBody');
        var conf = $('aiConf');

        if (!pred) {
            body.innerHTML = '<p class="muted">Not enough price history yet to make a prediction.</p>';
            conf.hidden = true;
            $('aiNote').textContent = '';
            return;
        }

        conf.hidden = false;
        conf.className = 'conf-pill conf-' + pred.confidence;
        conf.textContent = 'Confidence: ' + capitalize(pred.confidence);

        var t = pred.target;
        var headline;
        var sub;

        if (t) {
            if (t.reached) {
                headline = 'Target already reached';
            } else if (t.expectedDays !== null) {
                headline = 'Expected target range <strong>' + t.window + '</strong>';
            } else if (t.optimisticDays !== null) {
                headline = 'Target only reachable in the <strong>optimistic case</strong> (~' + Math.ceil(t.optimisticDays / 7) + ' wk)';
            } else {
                headline = 'Target <strong>unlikely within 3 months</strong> at this trend';
            }

            sub = 'to reach ' + money(t.price) + (t.reached ? '' : ' · ~' + Math.round(t.chance4w * 100) + '% likelihood within 4 weeks');
        } else {
            headline = 'Set a target price to see <strong>when AI expects it</strong>';
            sub = 'The forecast below assumes the current trend continues.';
        }

        var td = directionArrow(pred.direction === 'stable' ? 0 : pred.trendPctPerWeek);
        var trendText =
            pred.direction === 'stable'
                ? 'Price is stable'
                : (pred.direction === 'falling' ? 'Falling' : 'Rising') + ' ~' + pct(pred.trendPctPerWeek) + ' per week';

        var current = data.stats.current;
        var cps = [
            ['1 week', pred.checkpoints.week1],
            ['2 weeks', pred.checkpoints.week2],
            ['4 weeks', pred.checkpoints.week4]
        ]
            .map(function (c) {
                var change = ((c[1].price - current) / current) * 100;
                var d = directionArrow(change);

                return (
                    '<div class="cp"><span class="cp-label">' + c[0] + '</span>' +
                    '<strong>' + money(c[1].price) + '</strong>' +
                    '<span class="cp-range">' + money(c[1].low) + ' – ' + money(c[1].high) + '</span>' +
                    '<span class="cp-delta delta-' + d.cls + '">' + d.arrow + ' ' + pct(change) + '</span></div>'
                );
            })
            .join('');

        body.innerHTML =
            '<div class="ai-headline">' + headline + '</div>' +
            '<div class="ai-sub">' + sub + '</div>' +
            '<div class="ai-trend delta-' + td.cls + '">' + td.arrow + ' ' + trendText + '</div>' +
            '<div class="cp-grid">' + cps + '</div>';

        $('aiNote').textContent =
            pred.model + ' on ' + pred.dataPoints + ' days of prices. Forecasts are statistical estimates and can be wrong.';
    }

    /* ---------- smart price alert panel ---------- */

    function readTarget() {
        var v = Number($('targetInput').value);
        return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
    }

    function updatePreviewText() {
        var v = readTarget();
        var cur = state.data ? state.data.product.price : P.price;
        var el = $('targetPreview');

        if (!v) {
            el.textContent = '';
            el.className = 'muted small';
        } else if (v >= cur) {
            el.textContent = "Above today's price - this alert would fire immediately.";
            el.className = 'small warn';
        } else {
            el.textContent = money(cur - v) + ' (' + pct(((cur - v) / cur) * 100) + ") below today's price.";
            el.className = 'muted small';
        }
    }

    function renderAlertPanel(data) {
        var alert = data.alert;
        var pill = $('alertPill');
        var input = $('targetInput');

        if (!alert) {
            pill.className = 'status-pill off';
            pill.textContent = 'Price Alert: OFF';
            $('alertLead').textContent = 'Get notified the moment this product reaches your target price.';
        } else if (alert.reached) {
            pill.className = 'status-pill reached';
            pill.textContent = 'Target reached';
            $('alertLead').textContent = 'The price is at or below your target of ' + money(alert.target_price) + '.';
        } else {
            pill.className = 'status-pill on';
            pill.textContent = 'Price Alert: ON';
            $('alertLead').textContent = "We'll notify you when the price falls to " + money(alert.target_price) + ' or below.';
        }

        input.value = alert ? alert.target_price : '';
        input.placeholder = data.suggestedTarget ? 'e.g. ' + data.suggestedTarget : 'Your target price';
        $('alertSave').textContent = alert ? 'Update alert' : 'Set alert';
        $('alertOff').hidden = !alert;

        var current = data.stats.current;
        var chips = [5, 10, 15].map(function (p) {
            var value = roundStep(current * (1 - p / 100));
            return '<button type="button" class="chip" data-value="' + value + '">-' + p + '% · ' + money(value) + '</button>';
        });

        if (data.suggestedTarget) {
            chips.push('<button type="button" class="chip chip-ai" data-value="' + data.suggestedTarget + '">AI pick · ' + money(data.suggestedTarget) + '</button>');
        }

        $('targetChips').innerHTML = chips.join('');
        state.dirty = false;
        updatePreviewText();
    }

    function onTargetInput() {
        state.dirty = true;
        updatePreviewText();
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(function () {
            state.previewTarget = readTarget();
            load({ preview: true });
        }, 350);
    }

    function saveAlert() {
        var value = readTarget();

        if (!value) {
            showToast('Enter a valid target price.');
            return;
        }

        var btn = $('alertSave');
        btn.disabled = true;

        api('/api/price-alerts', { method: 'POST', body: { productId: P.id, targetPrice: value } })
            .then(function () {
                showToast("Price alert set - we'll notify you at " + money(value));
                updateAlertBadge();
                state.previewTarget = null;
                return load({});
            })
            .catch(function (err) {
                if (!handleAuthError(err)) {
                    showToast(err.message);
                }
            })
            .then(function () {
                btn.disabled = false;
            });
    }

    function turnOffAlert() {
        var alert = state.data && state.data.alert;

        if (!alert) {
            return;
        }

        api('/api/price-alerts/' + alert.id, { method: 'DELETE' })
            .then(function () {
                showToast('Price alert turned off.');
                updateAlertBadge();
                state.previewTarget = null;
                return load({});
            })
            .catch(function (err) {
                showToast(err.message);
            });
    }

    /* ---------- data loading ---------- */

    function renderMain(data) {
        renderHeader(data);
        drawChart(data);
        renderStats(data);
        renderAi(data);
    }

    function load(opts) {
        opts = opts || {};

        var url = '/api/products/' + P.id + '/insights?days=' + state.days;

        if (state.previewTarget) {
            url += '&target=' + encodeURIComponent(state.previewTarget);
        }

        return api(url)
            .then(function (data) {
                state.data = data;
                renderMain(data);

                if (!opts.preview) {
                    renderAlertPanel(data);
                }
            })
            .catch(function (err) {
                showToast(err.message);
            });
    }

    $('rangeTabs').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-days]');

        if (!btn) {
            return;
        }

        state.days = Number(btn.getAttribute('data-days'));

        Array.prototype.forEach.call($('rangeTabs').children, function (b) {
            b.classList.toggle('active', b === btn);
        });

        load({ preview: true });
    });

    $('targetChips').addEventListener('click', function (e) {
        var chip = e.target.closest('[data-value]');

        if (!chip) {
            return;
        }

        $('targetInput').value = chip.getAttribute('data-value');
        onTargetInput();
    });

    $('targetInput').addEventListener('input', onTargetInput);

    $('targetInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            saveAlert();
        }
    });

    $('alertSave').addEventListener('click', saveAlert);
    $('alertOff').addEventListener('click', turnOffAlert);

    load({});

    // Prices move over time, so keep the page fresh without clobbering
    // a target the user is still typing.
    setInterval(function () {
        load({ preview: state.dirty });
    }, 60000);
})();
