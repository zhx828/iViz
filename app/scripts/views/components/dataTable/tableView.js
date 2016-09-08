/**
 * Created by Karthik Kalletla on 6/20/16.
 */
'use strict';
(function(iViz, dc, _, React, ReactDOM) {
  // iViz pie chart component. It includes DC pie chart.
  iViz.view.component.TableView = function() {
    var content = this;
    var chartId_;
    var data_;
    var type_ = '';
    var attr_ = [];
    var attributes_ = [];
    var geneData_ = [];
    var selectedRows = [];
    var selectedGenes = [];
    var callbacks_ = {};
    var sequencedSampleIds = [];
    var selectedSamples = [];
    var allSamplesIds = [];
    var reactTableData = {};
    var initialized = false;
    var caseIndices = {};
    var selectedRowData = [];
    var selectedGeneData = [];
    var displayName = '';
    var categories_ = {};
    var reactData_;
    var isMutatedGeneCna = false;

    content.getCases = function() {
      return iViz.util.intersection(selectedSamples, sequencedSampleIds);
    };

    content.getSelectedRowData = function() {
      return selectedRowData;
    };

    content.clearSelectedRowData = function() {
      selectedRowData = [];
    };

    content.init =
      function(_attributes, _selectedSamples, _selectedGenes,
               _data, _chartId, _callbacks, _geneData) {
        initialized = false;
        allSamplesIds = _selectedSamples;
        selectedSamples = _selectedSamples;
        selectedSamples.sort();
        sequencedSampleIds = _attributes.options.sequencedCases;
        sequencedSampleIds.sort();
        selectedGenes = _selectedGenes;
        chartId_ = _chartId;
        caseIndices = iViz.getCaseIndices(_attributes.group_type);
        data_ = _data;
        geneData_ = _geneData;
        type_ = _attributes.type;
        displayName = _attributes.display_name || 'Table';
        attributes_ = _attributes;
        callbacks_ = _callbacks;
        isMutatedGeneCna = ['mutatedGene', 'cna'].indexOf(type_) !== -1
        initReactTable(true);
      };

    content.update = function(_selectedSamples, _selectedRows) {
      var selectedGenesMap_ = [];
      var includeMutationCount = false;
      if (_selectedRows !== undefined) {
        selectedRows = _selectedRows;
      }
      _selectedSamples.sort();
      if ((!initialized) ||
        (!iViz.util.compare(selectedSamples, _selectedSamples))) {
        initialized = true;
        selectedSamples = _selectedSamples;
        if (iViz.util.compare(allSamplesIds, selectedSamples)) {
          initReactTable(true);
        } else {
          _.each(_selectedSamples, function(caseId) {
            var caseIndex_ = caseIndices[caseId];
            var caseData_ = data_[caseIndex_];
            var tempData_ = '';
            switch (type_) {
              case 'mutatedGene':
                tempData_ = caseData_.mutated_genes;
                includeMutationCount = true;
                break;
              case 'cna':
                tempData_ = caseData_.cna_details;
                includeMutationCount = false;
                break;
              default:
                break;
            }
            _.each(tempData_, function(geneIndex) {
              if (selectedGenesMap_[geneIndex] === undefined) {
                selectedGenesMap_[geneIndex] = {};
                if (includeMutationCount) {
                  selectedGenesMap_[geneIndex].num_muts = 1;
                }
                selectedGenesMap_[geneIndex].caseIds = [caseId];
              } else {
                if (includeMutationCount) {
                  selectedGenesMap_[geneIndex].num_muts += 1;
                }
                selectedGenesMap_[geneIndex].caseIds.push(caseId);
              }
            });
          });
          initReactTable(true, selectedGenesMap_);
        }
      } else {
        initReactTable(false);
      }
    };

    content.updateGenes = function(genes) {
      selectedGenes = genes;
      initReactTable(false);
    };

    content.updateDataForDownload = function(fileType) {
      if (fileType === 'tsv') {
        initTsvDownloadData();
      }
    };

    function initReactTable(_reloadData, _selectedGenesMap) {
      if (_reloadData) {
        reactTableData = initReactData(_selectedGenesMap);
      }
      var _opts = {
        input: reactTableData,
        filter: 'ALL',
        download: 'NONE',
        downloadFileName: 'data.txt',
        showHide: false,
        hideFilter: true,
        scroller: true,
        resultInfo: false,
        groupHeader: false,
        fixedChoose: false,
        uniqueId: 'uniqueId',
        rowHeight: 25,
        tableWidth: 373,
        maxHeight: 290,
        headerHeight: 26,
        groupHeaderHeight: 40,
        autoColumnWidth: false,
        columnMaxWidth: 300,
        columnSorting: false,
        sortBy: 'cases',
        selectedRows: selectedRows,
        rowClickFunc: function(data, selected) {
          reactRowClickCallback(data, selected);
          reactSubmitClickCallback();
        },
        // sortBy: 'name',
        // sortDir: 'DESC',
        tableType: type_
      };
      if (isMutatedGeneCna) {
        _opts = _.extend(_opts, {
          rowClickFunc: reactRowClickCallback,
          selectedGene: selectedGenes,
          geneClickFunc: reactGeneClickCallback,
          selectButtonClickCallback: reactSubmitClickCallback
        });
      }
      var testElement = React.createElement(EnhancedFixedDataTableSpecial,
        _opts);

      ReactDOM.render(testElement, document.getElementById(chartId_));
    }

    function initRegularTableData() {
      var data = [];
      _.each(categories_, function(category, name) {
        for (var key in category) {
          if (category.hasOwnProperty(key)) {
            var datum = {
              attr_id: key,
              uniqueId: name,
              attr_val: key === 'caseIds' ? category.caseIds.join(',') : category[key]
            };
            data.push(datum);
          }
        }
      });
      reactData_ = data;
    }

    function initCategories() {
      var colors = $.extend(true, [], iViz.util.getColors());
      _.each(data_, function(item) {
        var _datum = item[attributes_.attr_id];
        var color = colors.shift();

        if (!_datum) {
          _datum = 'NA';
          color = '#cccccc';
        }

        if (!categories_.hasOwnProperty(_datum)) {
          categories_[_datum] = {
            name: _datum,
            cases: 0,
            color: color ? color : iViz.util.getRandomColorOutOfLib(),
            caseIds: []
          };
        }
        ++categories_[_datum].cases;
        categories_[_datum].caseIds.push(item.patient_id ? item.patient_id : item.sample_id);
      });
      _.each(categories_, function(category) {
        category.caseRate =
          (((category.cases / data_.length).toPrecision(2) * 100)).toString() +
          '%';
      });
    }

    function mutatedGenesData(_selectedGenesMap) {
      var numOfCases_ = content.getCases().length;

      selectedGeneData.length = 0;

      if (geneData_) {
        _.each(geneData_, function(item, index) {
          var datum = {};
          datum.gene = item.gene;
          if (_selectedGenesMap === undefined) {
            datum.caseIds = iViz.util.unique(item.caseIds);
            datum.cases = datum.caseIds.length;
            datum.uniqueId = index;
            switch (type_) {
              case 'mutatedGene':
                datum.numOfMutations = item.num_muts;
                datum.sampleRate = (numOfCases_ <= 0 ? 0 :
                    ((datum.cases / Number(numOfCases_) * 100).toFixed(1))) +
                  '%';
                break;
              case 'cna':
                datum.cytoband = item.cytoband;
                datum.altType = item.cna;
                datum.altrateInSample = ((numOfCases_ <= 0 ? 0 :
                    (datum.cases / numOfCases_ * 100).toFixed(1))) + '%';
                break;
              default:
                break;
            }
          } else {
            if (_selectedGenesMap[item.index] === undefined) {
              return;
            }
            datum.caseIds =
              iViz.util.unique(_selectedGenesMap[item.index].caseIds);
            datum.cases = datum.caseIds.length;
            switch (type_) {
              case 'mutatedGene':
                datum.numOfMutations = _selectedGenesMap[item.index].num_muts;
                datum.sampleRate = (numOfCases_ <= 0 ? 0 :
                    ((datum.cases / Number(numOfCases_) * 100).toFixed(
                      1))) + '%';
                datum.uniqueId = datum.gene;
                break;
              case 'cna':
                datum.cytoband = item.cytoband;
                datum.altType = item.cna;
                datum.altrateInSample = ((numOfCases_ <= 0 ? 0 :
                    (datum.cases / numOfCases_ * 100).toFixed(1))) + '%';
                datum.uniqueId = datum.gene + '-' + datum.altType;
                break;
              default:
                break;
            }
          }

          if (item.qval === null) {
            datum.qval = '';
          } else {
            var qval = Number(item.qval);
            if (qval === 0) {
              datum.qval = 0;
            } else {
              datum.qval = qval.toExponential(1);
            }
          }
          selectedGeneData.push(datum);
        });
      }
      return selectedGeneData;
    }

    function initReactData(_selectedGenesMap) {
      attr_ = iViz.util.tableView.getAttributes(type_);
      var result = {
        data: [],
        attributes: attr_
      };

      if (isMutatedGeneCna) {
        var _mutationData = mutatedGenesData(_selectedGenesMap);
        _.each(_mutationData, function(item) {
          for (var key in item) {
            if (item.hasOwnProperty(key)) {
              var datum = {
                attr_id: key,
                uniqueId: item.uniqueId,
                attr_val: key === 'caseIds' ? item.caseIds.join(',') : item[key]
              };
              result.data.push(datum);
            }
          }
        });
      } else {
        categories_ = {};
        result.attributes[0].display_name = displayName;
        initCategories();
        initRegularTableData();
        result.data = reactData_;
      }
      return result;
    }

    function reactSubmitClickCallback() {
      callbacks_.submitClick(selectedRowData);
    }

    function reactRowClickCallback(data, selected) {
      if (selected) {
        selectedRowData.push(data);
      } else {
        selectedRowData = _.filter(selectedRowData, function(item) {
          return (item.uniqueId !== data.uniqueId);
        });
      }
    }

    function reactGeneClickCallback(selectedRow) {
      callbacks_.addGeneClick(selectedRow);
    }

    function initTsvDownloadData() {
      var attrs =
        iViz.util.tableView.getAttributes(type_).filter(function(attr) {
          return attr.attr_id !== 'uniqueId';
        });
      var downloadOpts = {
        fileName: displayName,
        data: ''
      };

      if (_.isArray(attrs) && attrs.length > 0) {
        var data = attrs.map(
            function(attr) {
              return attr.display_name;
            }).join('\t') + '\n';

        _.each(selectedGeneData, function(row) {
          var _tmp = [];
          _.each(attrs, function(attr) {
            _tmp.push(row[attr.attr_id] || '');
          });
          data += _tmp.join('\t') + '\n';
        });

        downloadOpts.data = data;
      }
      content.setDownloadData('tsv', downloadOpts);
    }
  };

  iViz.view.component.TableView.prototype =
    new iViz.view.component.GeneralChart('table');

  iViz.util.tableView = (function() {
    var content = {};
    content.compare = function(arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false;
      }
      for (var i = 0; i < arr2.length; i++) {
        if (arr1.indexOf(arr2[i]) === -1) {
          return false;
        }
      }
      return true;
    };

    content.getAttributes = function(type) {
      var _attr = [];
      switch (type) {
        case 'mutatedGene':
          _attr = [
            {
              attr_id: 'gene',
              display_name: 'Gene',
              datatype: 'STRING',
              column_width: 100
            }, {
              attr_id: 'numOfMutations',
              display_name: '# Mut',
              datatype: 'NUMBER',
              column_width: 90
            },
            {
              attr_id: 'cases',
              display_name: '#',
              datatype: 'NUMBER',
              column_width: 90
            },
            {
              attr_id: 'sampleRate',
              display_name: 'Freq',
              datatype: 'PERCENTAGE',
              column_width: 93
            },
            {
              attr_id: 'caseIds',
              display_name: 'Cases',
              datatype: 'STRING',
              show: false
            },
            {
              attr_id: 'uniqueId',
              display_name: 'uniqueId',
              datatype: 'STRING',
              show: false
            },
            {
              attr_id: 'qval',
              datatype: 'NUMBER',
              display_name: 'MutSig',
              show: false
            }
          ];
          break;
        case 'cna':
          _attr = [
            {
              attr_id: 'gene',
              display_name: 'Gene',
              datatype: 'STRING',
              column_width: 80
            },
            {
              attr_id: 'cytoband',
              display_name: 'Cytoband',
              datatype: 'STRING',
              column_width: 90
            },
            {
              attr_id: 'altType',
              display_name: 'CNA',
              datatype: 'STRING',
              column_width: 55
            },
            {
              attr_id: 'cases',
              display_name: '#',
              datatype: 'NUMBER',
              column_width: 70
            },
            {
              attr_id: 'altrateInSample',
              display_name: 'Freq',
              datatype: 'PERCENTAGE',
              column_width: 78
            },
            {
              attr_id: 'caseIds',
              display_name: 'Cases',
              datatype: 'STRING',
              show: false
            },
            {
              attr_id: 'uniqueId',
              display_name: 'uniqueId',
              datatype: 'STRING',
              show: false
            },
            {
              attr_id: 'qval',
              datatype: 'NUMBER',
              display_name: 'Gistic',
              show: false
            }
          ];
          break;
        default:
          _attr = [
            {
              attr_id: 'name',
              display_name: 'Unknown',
              datatype: 'STRING',
              column_width: 213
            }, {
              attr_id: 'color',
              display_name: 'Color',
              datatype: 'STRING',
              show: false
            }, {
              attr_id: 'cases',
              display_name: '#',
              datatype: 'NUMBER',
              column_width: 70
            }, {
              attr_id: 'caseRate',
              display_name: 'Freq',
              datatype: 'PERCENTAGE',
              column_width: 90
            }, {
              attr_id: 'caseIds',
              display_name: 'Cases',
              datatype: 'STRING',
              show: false
            }, {
              attr_id: 'uniqueId',
              display_name: 'uniqueId',
              datatype: 'STRING',
              show: false
            }];
          break;
      }
      return _attr;
    };
    return content;
  })();
})(
  window.iViz,
  window.dc,
  window._,
  window.React,
  window.ReactDOM
);
