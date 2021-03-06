(function(exports) {

  var initialize = function() {
    this._cells = [].slice.call(this.querySelectorAll('tr > [data-value]'));
    this.nested_cells = [].slice.call(this.querySelectorAll('tr > [data-value] > [data-value]'));
    this._cells = this._cells.concat(this.nested_cells)
    this.eitiDataMap = this.parentNode.parentNode.querySelector('eiti-data-map');
    this.isCountyTable = d3.select(this).classed('county-table');

    this.setYear();
    this.update();
  };

  var WITHHELD_FLAG = 'Withheld';

  var setYear = function(year) {
    var root = d3.select(this);

    if (root.classed('county-table')) {

      function parseYearVals(context) {
        var yearVals = context.getAttribute('data-year-values') &&
            context.getAttribute('data-year-values') !== 'null'
              ? context.getAttribute('data-year-values')
              : '{}';
        return JSON.parse(yearVals);
      }

      function coerceNumber(num) {
        return typeof(num) == undefined || typeof(num) == 'undefined'
          ? WITHHELD_FLAG
          :  num;
      }

      function cellData(data, year, property, coerce) {
        if (data && data[year] && property) {
          return data[year][property] || coerceNumber(coerce);
        } else if (data && !property) {
          return data[year] || coerceNumber(coerce);
        } else {
          return coerceNumber(coerce);
        }
      }

      function formatText(context, value) {
        var format = d3.format(context.getAttribute('data-format') || ',')

        if (context.getAttribute('data-format') === '%') {
          format = function(d) {
            if (d === 0) {
              return 0;
            } else if (d < 1) {
              return '<1%';
            }
            return d3.format('%')(d / 100);
          }
        }

        if (value === WITHHELD_FLAG || !format) {
          return value;
        } else {
          return format(value);
        }
      }

      var year = year || '2013';
      var bars = root.selectAll('[data-value]');
      var texts = root.selectAll('[data-value-text]');
      var sentences = root.selectAll('[data-sentence]');
      var swatches = root.selectAll('[data-value-swatch]');
      var label = d3.select(this.parentElement).select('label');

      var rows = root.selectAll('tr[data-year-values]');

      bars.datum(function() {
          var data = parseYearVals(this)
          var property = this.getAttribute('data-years-property');
          return cellData(data, year, property, 0);
        })
        .attr('data-value', function(d) {
          return d;
        });

      var sentencesData = sentences.datum(function() {
          var data = parseYearVals(this)
          var property = this.getAttribute('data-years-property');
          return cellData(data, year, property);
        }).attr('data-sentence', function(d) {
          return d;
        })
        .attr('data-withheld', function(d) {
          return d === WITHHELD_FLAG
            ? true
            : false;
        });

      sentencesData.select('.withheld')
        .attr('aria-hidden', function(d) {
          return d === WITHHELD_FLAG
            ? false
            : true;
        });

      sentencesData.select('.has-data')
        .attr('aria-hidden', function(d) {
          return d === WITHHELD_FLAG
            ? true
            : false;
        });

      sentencesData.select('[data-value]').attr('data-value', function(d) {
          return d;
        }).text(function(d) {
          return formatText(this, d);
        })

      texts.datum(function() {
          var data = parseYearVals(this)
          var property = this.getAttribute('data-years-property');
          return cellData(data, year, property);
        })
        .attr('data-value-text', function(d) {
          return d;
        })
        .text(function(d) {
          return formatText(this, d);
        });

      var that = this;
      swatches.datum(function() {
          var data = parseYearVals(this);
          var property = this.getAttribute('data-years-property');
          return cellData(data, year, property);
        })
        .attr('data-value-swatch', function(d) {
          return d;
        })
        .style('background-color', function (d) {
          if (d && that.eitiDataMap.scale) {
            return that.eitiDataMap.scale(d);
          }
        });

      label.select('[data-year]')
        .attr('data-year', year)
        .text(year)

      sentences.select('[data-year]')
        .attr('data-year', year)
        .text(year)

      rows.datum(function(){
        var data = parseYearVals(this);
        return data[year] || WITHHELD_FLAG;
      })
      .attr('aria-hidden', function (d) {
        return !d;

      });
    }
  }

  var show = function(fips) {
    var rows = d3.select(this).selectAll('tbody > tr');
    rows.classed('selected', false);

    rows.selectAll('[data-sentence]').attr('aria-hidden', true);

    // show matching row
    rows.filter(function(row) {
      return this.getAttribute('data-fips') === fips;
    })
    .classed('selected', true)
    .select('[data-sentence]')
    .attr('aria-hidden', false);

  }

  var update = function() {
    if (!this._cells.length) {
      return;
    }

    var series = {};
    var autolabel = this.getAttribute('autolabel') === 'true';

    this._cells.forEach(function(cell) {
      var key = cell.dataset.series || 'default';

      if (key in series) {
        series[key].push(cell);
      } else {
        series[key] = [cell];
      }
    });

    Object.keys(series).forEach(function(key) {
      var cells = series[key];
      var values = cells.map(function(cell) {
        return +cell.dataset.value;
      });

      var extent = d3.extent(values);
      if (this.hasAttribute('data-' + key + '-min')) {
        extent[0] = +this.dataset[key + 'Min'];
      } else if (this.hasAttribute('data-min')) {
        extent[0] = +this.dataset.min;
      } else {
        extent[0] = Math.min(extent[0], 0);
      }

      if (this.hasAttribute('data-' + key + '-max')) {
        extent[1] = +this.dataset[key + 'Max'];
      } else if (this.hasAttribute('data-max')) {
        extent[1] = +this.dataset.max;
      }

      var range = [0, 100];
      var min = extent[0];
      var max = extent[1];
      var negative = min < 0;
      var zero = 0;
      var width = d3.scale.linear()
        .domain(extent)
        .range(range)
        .clamp(true);

      var offset;
      var sizeProperty = 'width';
      var offsetProperty = 'margin-left';

      if (negative) {
        var length = max - min;
        zero = 100 * (0 - min) / length;
        offset = d3.scale.linear()
          .domain([min, 0, max])
          .range([0, zero, zero])
          .clamp(true);
        width = d3.scale.linear()
          .domain([min, 0, max])
          .range([100 * -min / length, 0, 100 * max / length])
          .clamp(true);
      }

      if (this.orient === 'vertical') {
        sizeProperty = 'height';
        offsetProperty = 'bottom';
      }

      var that = this;
      cells.forEach(function(cell, i) {
        if (!cell) {
          console.warn('no cell @', i);
          return;
        } else if (cell.parentNode.hasAttribute('data-value')) {
          console.warn('cell is child', i);
        }

        var cellAlwaysEmpty = cell.getAttribute('data-year-values') === 'null';
        var childCell = cell.querySelector('[data-value]');

        // TODO only do this if autolabel="true"?
        if (cell.childNodes.length === 1 && cell.firstChild.nodeType === Node.TEXT_NODE) {
          if (autolabel) {
            cell.setAttribute('aria-label', cell.firstChild.textContent);
            cell.removeChild(cell.firstChild);
          } else {
            var text = cell.removeChild(cell.firstChild);
            var span = cell.appendChild(document.createElement('span'));
            span.className = 'text';
            span.appendChild(text);
          }
        }


        var barExtent = cell.querySelector('.bar');
        if (barExtent) {
          var bar = barExtent.querySelector('.bar');
        }

        if (!barExtent && !bar) {
          barExtent = document.createElement('div');
          barExtent.className = 'bar';
          bar = document.createElement('div');
          bar.className = 'bar';
          var span = cell.querySelector('span');
          if (barExtent && bar) {
            if (span) {
              cell.insertBefore(barExtent,span);
            } else if (that.isCountyTable && !cellAlwaysEmpty) {
              cell.appendChild(barExtent);
            }
            barExtent.appendChild(bar);
          }
        }

        if (childCell) {
          var childBar = document.createElement('div');
          childBar.className = 'bar';
          bar.appendChild(childBar);
        }

        var value = +cell.dataset.value;
        var size = width(value);

        if (childCell) {
          var childValue = +childCell.dataset.value;
          size = width(value) + width(childValue);
          var diff = childValue - value;
          var largerSize = diff > 0
            ? width(childValue) / (size / 100)
            : width(value) / (size / 100);
          bar.style.setProperty(sizeProperty, Math.abs(size) + '%');
          childBar.style.setProperty(sizeProperty, Math.abs(largerSize) + '%');
        } else {
          bar.style.setProperty(sizeProperty, Math.abs(size) + '%');
        }

        if (offset) {
          bar.style.setProperty(offsetProperty, offset(value) + '%');
        } else {
          bar.style.removeProperty(offsetProperty);
        }
      });

    }, this);
  };

  exports.EITIBarChartTable = document.registerElement('bar-chart-table', {
    'extends': 'table',
    prototype: Object.create(
      HTMLTableElement.prototype,
      {
        attachedCallback: {value: initialize},

        attributeChangedCallback: {value: function(attr, old, value) {
          switch (attr) {
            case 'orient':
              this.update();
          }
        }},

        update: {value: update},

        setYear: {value: setYear},

        show: {value: show},

        orient: {
          get: function() {
            return this.getAttribute('orient');
          },
          set: function(value) {
            if (value !== this.orient) {
              this.setAttribute('orient', value);
            }
          }
        }
      }
    )
  });

})(this);
