/*!
 * This program is free software; you can redistribute it and/or modify it under the
 * terms of the GNU Lesser General Public License, version 2.1 as published by the Free Software
 * Foundation.
 *
 * You should have received a copy of the GNU Lesser General Public License along with this
 * program; if not, you can obtain a copy at http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html
 * or from the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Lesser General Public License for more details.
 *
 * Copyright (c) 2002-2023 Hitachi Vantara..  All rights reserved.
 */
define([
  "./browser.fileButtons",
  "./browser.folderButtons",
  "./browser.trashButtons",
  "./browser.trashItemButtons",
  "./browser.utils",
  "./browser.multiSelectButtons",
  "./dialogs/browser.dialog.rename",
  "common-ui/util/spin",
  "common-ui/util/PentahoSpinner",
  "./browser.templates",
  "common-ui/util/URLEncoder",
  "common-ui/util/_a11y",
  "common-ui/bootstrap",
  "common-ui/handlebars",
  "common-ui/jquery-pentaho-i18n",
  "common-ui/jquery"
], function (FileButtons, FolderButtons, TrashButtons, TrashItemButtons, BrowserUtils, MultiSelectButtons, RenameDialog, Spinner, spin, templates, Encoder, a11yUtil) {

  if (window.parent.mantle_isBrowseRepoDirty == undefined) {
    window.parent.mantle_isBrowseRepoDirty = false;
  }
  this.FileBrowser = {};

  FileBrowser.urlParam = function (paramName) {
    var value = new RegExp('[\\?&]' + paramName + '=([^&#]*)').exec(window.parent.location.href);
    if (value) {
      return value[1];
    } else {
      return null;
    }
  };

  var locale = FileBrowser.urlParam('locale');
  if( !locale ) {
    // look to see if locale is set on the page in a meta tag
    var localeMeta = $("meta[name='locale']");
    if(localeMeta) {
      locale = localeMeta.attr("content");
    }
  }

  // retrieve i18n map
  jQuery.i18n.properties({
    name: 'messages',
    mode: 'map',
    language: locale
  });

  var renameDialog = new RenameDialog(jQuery.i18n);
  var fileButtons = new FileButtons(jQuery.i18n);
  var folderButtons = new FolderButtons(jQuery.i18n);
  var trashButtons = new TrashButtons(jQuery.i18n);
  var trashItemButtons = new TrashItemButtons(jQuery.i18n);
  var browserUtils = new BrowserUtils();
  var multiSelectButtons = new MultiSelectButtons(jQuery.i18n);
  // BACKLOG-30159 -- depth preset to 3 because initial folder will be /home/<user> (i.e. /home/admin)
  // and we need 3 levels, 1. home, 2. <user>, and 3. any folders within /home/<user>
  var depth = 3;

  fileButtons.renameDialog = renameDialog;
  folderButtons.renameDialog = renameDialog;

  FileBrowser.$container = null;
  FileBrowser.fileBrowserModel = null;
  FileBrowser.fileBrowserView = null;
  FileBrowser.openFileHandler = undefined;
  FileBrowser.showHiddenFiles = false;
  FileBrowser.showDescriptions = false;
  FileBrowser.canDownload = false;
  FileBrowser.canPublish = false;
  FileBrowser.canRead = false;
  FileBrowser.canCreate = false;

  /**
   * Encode a path that has the slashes converted to colons
   **/
  FileBrowser.encodePathComponents = function (path) {
    return Encoder.encode("{0}", path);
  };

  FileBrowser.setShowHiddenFiles = function (value) {
    this.showHiddenFiles = value;
  };

  FileBrowser.setShowDescriptions = function (value) {
    this.showDescriptions = value;
  };

  FileBrowser.setCanDownload = function (value) {
    this.canDownload = value;
  }

  FileBrowser.setCanPublish = function (value) {
    this.canPublish = value;
  }

  FileBrowser.setCanRead = function (value) {
    this.canRead = value;
  }

  FileBrowser.setCanCreate = function (value) {
    this.canCreate = value;
  }

  FileBrowser.updateShowDescriptions = function (value) {
    this.setShowDescriptions(value);
    this.fileBrowserModel.set("showDescriptions", value);
  };

  FileBrowser.setContainer = function ($container) {
    this.$container = $container;
  };

  FileBrowser.setOpenFileHandler = function (handler) {
    this.openFileHandler = handler;
  };

  FileBrowser.update = function (initialPath, showDescriptions) {
    this.redraw(initialPath, showDescriptions);
  };

  FileBrowser.updateFolder = function (clickedPath, showDescriptions) {
    // Sets initialPath as the clicked folder
    if (this.fileBrowserModel && clickedPath) {
      this.fileBrowserModel.set("clickedFolder", {
        obj: $("[path='" + clickedPath + "']"),
        time: (new Date()).getTime()
      });
    }
    this.redraw(clickedPath, showDescriptions);
  };

  FileBrowser.updateData = function () {
    if (this.fileBrowserModel != null && this.fileBrowserModel.get('fileListModel') != null) {
      this.fileBrowserModel.get('fileListModel').updateData();
    }
  };

  FileBrowser.concatArray = function (arr1, arr2) {
    for (var i = 0; i < arr2.length; i++) {
      FileBrowser.pushUnique(arr1, arr2[i]);
    }
    return arr1;
  };

  FileBrowser.pushUnique = function (array, item) {
    var exists = false;
    for (var i = 0; i < array.length; i++) {
      if (item.obj.attr("id") == array[i].obj.attr("id")) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      array.push(item);
    }
  };

  FileBrowser.redraw = function (initialPath, _showDescriptions) {
    var myself = this;
    var _clikedFolder = undefined;
    var _clickedFile = undefined;
    var _lastClick = "folder";
    if ( this.fileBrowserModel ) {
      _clikedFolder = {
        obj: this.fileBrowserModel.getFolderClicked(),
        time: (new Date()).getTime()
      };
      _clickedFile = {
        obj: this.fileBrowserModel.getFileClicked(),
        time: (new Date()).getTime()
      };
      _lastClick = this.fileBrowserModel.getLastClick();
    }
    //if we have not new parameter, than save previous
    if ( _showDescriptions == undefined ) {
      _showDescriptions = myself.showDescriptions;
    }
    myself.fileBrowserModel = new FileBrowserModel({
      spinConfig: spin,
      openFileHandler: myself.openFileHandler,
      showHiddenFiles: myself.showHiddenFiles,
      showDescriptions: _showDescriptions,
      canDownload: myself.canDownload,
      canPublish: myself.canPublish,
      canRead: myself.canRead,
      canCreate: myself.canCreate,
      startFolder: initialPath,
      clickedFolder: _clikedFolder,
      clickedFile: _clickedFile,
      lastClick: _lastClick
    });
    myself.FileBrowserView = new FileBrowserView({
      model: myself.fileBrowserModel,
      el: myself.$container
    });

    //BISERVER-10586 - need to run listener after fileBrowserModel listener
    myself.fileBrowserModel.on("change:clickedFolder", myself.fileBrowserModel.updateFileList, myself.fileBrowserModel);

    //Kill text selection in all IE browsers for the browse perspective
    $("#fileBrowser").bind("selectstart", function(){return false});
  };

  FileBrowser.openFolder = function (path) {
    //first select folder
    var $folder = $("[path='"+path+"']"),
        $parentFolder = $folder.parent(".folders");
    while(!$parentFolder.hasClass("body") && $parentFolder.length > 0){
      $parentFolder.show();
      $parentFolder.parent().addClass("open");
      $parentFolder = $parentFolder.parent().parent();
    }
    $folder.find("> .element .name").trigger("click");
  };

  var FileBrowserModel = Backbone.Model.extend({
    defaults: {
      showHiddenFilesURL: CONTEXT_PATH + "api/user-settings/MANTLE_SHOW_HIDDEN_FILES",
      fileButtons: fileButtons,
      folderButtons: folderButtons,
      trashButtons: trashButtons,
      trashItemButtons: trashItemButtons,
      browserUtils: browserUtils,
      multiSelectButtons: multiSelectButtons,

      foldersTreeModel: undefined,
      fileListModel: undefined,

      clickedFolder: undefined,
      clickedFile: undefined,
      startFolder: window.parent.HOME_FOLDER,
      lastClick: "folder",
      data: undefined,
      openFileHandler: undefined,

      showHiddenFiles: false,
      showDescriptions: false,

      canDownload: false,
      canPublish: false,
      spinConfig: undefined
    },

    initialize: function () {
      var myself = this,
          foldersTreeModel = myself.get("foldersTreeModel"),
          fileListModel = myself.get("fileListModel");
      //handle data
      var foldersObj = {}
      //get spinner and give a new to each browser
      var config = myself.get("spinConfig").getLargeConfig();
      var spinner1 = new Spinner(config),
          spinner2 = new Spinner(config);
      var _clickedFolder = undefined;
      var _clickedFile = undefined;
      if ( foldersTreeModel ) {
        _clickedFolder = {
          obj: foldersTreeModel.get("clickedFolder"),
          time: (new Date()).getTime()
        }
      }
      if ( fileListModel ) {
        _clickedFile = {
          obj: fileListModel.get("clickedFile"),
          time: (new Date()).getTime()
        }
      }
      //create two models
      foldersTreeModel = new FileBrowserFolderTreeModel({
        spinner: spinner1,
        showHiddenFiles: myself.get("showHiddenFiles"),
        showDescriptions: myself.get("showDescriptions"),
        startFolder: myself.get("startFolder"),
        clickedFolder: _clickedFolder
      });
      fileListModel = new FileBrowserFileListModel({
        spinner: spinner2,
        openFileHandler: myself.get("openFileHandler"),
        showHiddenFiles: myself.get("showHiddenFiles"),
        showDescriptions: myself.get("showDescriptions"),
        clickedFile: _clickedFile
      });

      //assign backbone events
      foldersTreeModel.on("change:clicked", myself.updateClicked, myself);
      foldersTreeModel.on("change:clickedFolder", myself.updateFolderClicked, myself);

      fileListModel.on("change:clickedFile", myself.updateFileClicked, myself);

      //handlers for buttons header update
      foldersTreeModel.on("change:clicked", myself.updateFolderLastClick, myself);
      fileListModel.on("change:clicked", myself.updateFileLastClick, myself);

      myself.set("foldersTreeModel", foldersTreeModel);
      myself.set("fileListModel", fileListModel);

      myself.on("change:showDescriptions", myself.updateDescriptions, myself);

      window.parent.mantle_addHandler("FavoritesChangedEvent", $.proxy(myself.onFavoritesChanged, myself));
    },
    onFavoritesChanged: function () {
      // BISERVER-9127  - Reselect current file
      var that = this;
      setTimeout(function () {
        that.get('fileListModel').trigger("change:clickedFile");
      }, 100);
    },

    updateClicked: function () {
      this.set("clicked", true);
    },

    updateFolderClicked: function () {
      var clickedFolder = this.get("foldersTreeModel").get("clickedFolder");
      var folderPath = clickedFolder.obj.attr("path");
      if (folderPath == ".trash") {
        this.updateTrashLastClick();
      }
      this.set("clickedFolder", clickedFolder);
      this.updateFolderButtons(folderPath);
    },

    updateFolderButtons: function( _folderPath) {
      var userHomePath = Encoder.encodeRepositoryPath(window.parent.HOME_FOLDER);
      var model = FileBrowser.fileBrowserModel; // trap model
      var folderPath = Encoder.encodeRepositoryPath( _folderPath);

      // BACKLOG-23730: server+client side code uses centralized logic to check if user can download/upload
      //
      // Ajax request to check if user can download
      $.ajax({
        url: CONTEXT_PATH + "api/repo/files/canDownload?dirPath=" + encodeURIComponent( _folderPath ),
        type: "GET",
        async: true,
        success: function (response) {
          folderButtons.canDownload(response == "true");
        },
        error: function (response) {
          folderButtons.canDownload(false);
        }
      });

      // Ajax request to check if user can upload (a.k.a. publish)
      $.ajax({
        url: CONTEXT_PATH + "api/repo/files/canUpload?dirPath=" + encodeURIComponent( _folderPath ),
        type: "GET",
        async: true,
        success: function (response) {
          folderButtons.canPublish(response == "true");
        },
        error: function (response) {
          folderButtons.canPublish(false);
        }
      });

      //Ajax request to check write permissions for folder
      $.ajax({
        url: CONTEXT_PATH + 'api/repo/files/' + FileBrowser.encodePathComponents(folderPath) + '/canAccessMap',
        type: "GET",
        beforeSend: function (request) {
          request.setRequestHeader('accept', 'application/json');
        },
        data: {"permissions": "1"}, //check write permissions for the given folder
        async: true,
        cache: false,
        success: function (response) {
          folderButtons.updateFolderPermissionButtons(response, model.get('browserUtils').multiSelectItems, !(folderPath == userHomePath));
        },
        error: function (response) {
          folderButtons.updateFolderPermissionButtons(false, model.get('browserUtils').multiSelectItems, false);
        }
      });
    },

    updateFileClicked: function () {
      var clickedFile = this.get("fileListModel").get("clickedFile");
      this.set("clickedFile", clickedFile);

      var clickedFolder = this.get("clickedFolder");
      var didClickTrash = (!!clickedFolder) && clickedFolder.obj.attr("path") == ".trash";
      if (didClickTrash) {
        this.updateTrashItemLastClick();
      }

      if ( clickedFile == null ) {
        fileButtons.updateFilePermissionButtons(false);
        fileButtons.canDownload(false);
        return;
      }

      if (!didClickTrash) {
        // BISERVER-9127 - Provide the selected path to the FileButtons object
        fileButtons.onFileSelect(clickedFile.obj.attr("path"));
      }

      fileButtons.canDownload(this.get("canDownload"));
      //TODO handle file button press
      var filePath = clickedFile.obj.attr("path");
      filePath = Encoder.encodeRepositoryPath(filePath);

      //Ajax request to check write permissions for file
      $.ajax({
        url: CONTEXT_PATH + 'api/repo/files/' + FileBrowser.encodePathComponents(filePath) + '/canAccessMap',
        type: "GET",
        beforeSend: function (request) {
          request.setRequestHeader('accept', 'application/json');
        },
        data: {"permissions": "1|2"}, //check write and delete permissions for the given file
        async: true,
        cache: false,
        success: function (response) {
          fileButtons.updateFilePermissionButtons(response);
        },
        error: function (response) {
          fileButtons.updateFilePermissionButtons(false);
        }
      });
    },

    updateFolderLastClick: function () {
      this.set("lastClick", "folder");
    },

    updateFileLastClick: function () {
      this.set("lastClick", "file");
    },

    updateTrashLastClick: function () {
      this.set("lastClick", "trash");
    },

    updateTrashItemLastClick: function () {
      this.set("lastClick", "trashItem");
    },

    getLastClick: function () {
      return this.get("lastClick");
    },

    getFolderClicked: function () {
      return this.get("clickedFolder") == null || this.get("clickedFolder") == undefined ? null : this.get("clickedFolder").obj;
    },

    getFileClicked: function () {
      return this.get("clickedFile") == null || this.get("clickedFile") == undefined ? null : this.get("clickedFile").obj; // [BISERVER-9128] - wrap in jquery object
    },

    updateFileList: function () {
      var myself = this;
      //trigger file list update. Force event in case path was not changed
      myself.get("fileListModel").set("path", myself.get("clickedFolder").obj.attr("path"), {silent:true});
      myself.get("fileListModel").trigger('change:path');
    },

    updateDescriptions: function () {
      var myself = this;
      myself.get("fileListModel").set("showDescriptions", myself.get("showDescriptions"));
      myself.get("foldersTreeModel").set("showDescriptions", myself.get("showDescriptions"));
    }
  });

  var FileBrowserFolderTreeModel = Backbone.Model.extend({
    defaults: {
      clicked: false,
      clickedFolder: undefined,

      data: undefined,
      updateData: false,

      runSpinner: false,
      spinner: undefined,

      showHiddenFiles: false,
      showDescriptions: false,
      sequenceNumber: 0
    },

    initialize: function () {
      var myself = this;
      myself.on("change:updateData", myself.updateData, myself);
    },

    updateData: function () {
      var myself = this;
      myself.set("runSpinner", true);
      myself.fetchData("/", function (response) {
        var trash = {
          "file": {
            "trash": "trash",
            "createdDate": "1365427106132",
            "fileSize": "0",
            "folder": "true",
            "hidden": "false",
            "id:": jQuery.i18n.prop('trash'),
            "locale": "en",
            "locked": "false",
            "name": jQuery.i18n.prop('trash'),
            "ownerType": "-1",
            "path": ".trash",
            "title": jQuery.i18n.prop('trash'),
            "versioned": "false"
          }
        };
        //Add trash to data model
        response.children.push(trash);
        myself.set("data", response);
      });
    },

    fetchData: function (path, callback) {
      var myself = this,
          tree = null,
          localSequenceNumber = myself.get("sequenceNumber");
      var url = this.getFileTreeRequest(FileBrowser.encodePathComponents(path == null ? ":" : Encoder.encodeRepositoryPath(path)));
      $.ajax({
        async: true,
        cache: false, // prevent IE from caching the request
        dataType: "json",
        url: url,
        success: function (response) {
          if (localSequenceNumber == myself.get("sequenceNumber") && callback != undefined) {
            myself.set("sequenceNumber", localSequenceNumber + 1);
            callback(customSort(response));
          }
        },
        error: function () {
        },
        beforeSend: function (xhr) {
          myself.set("runSpinner", true);
        }
      });
    },

    /*
     * Path has already been converted to colons
     */
    getFileTreeRequest: function (path) {
      return CONTEXT_PATH + "api/repo/files/" + path + "/tree?depth=" + depth
          + "&showHidden=" + this.get("showHiddenFiles") + "&filter=*%7CFOLDERS";
    }
  });

  var FileBrowserFileListModel = Backbone.Model.extend({
    defaults: {
      clicked: false,
      clickedFile: undefined,
      anchorPoint: undefined,
      multiSelect: [],
      shiftLasso: [],
      clipboard: [],

      data: undefined,
      cachedData: {},
      path: "/",

      runSpinner: false,
      spinner: undefined,

      openFileHander: undefined,

      showHiddenFiles: false,
      showDescriptions: false,
      deletedFiles: "",

      sequenceNumber: 0
    },

    initialize: function () {
      var myself = this;
      myself.set("cachedData", {}); // clear cached data on initialization - Backbone relates to old cachedData when new object is created
      myself.on("change:path", myself.updateData, myself);
    },

    reformatTrashResponse: function (myself, response) {
      var newResp = {
        children: []
      }
      if (response && response.repositoryFileDto) {
        myself.set("deletedFiles", "");
        for (var i = 0; i < response.repositoryFileDto.length; i++) {
          var obj = {
            file: Object
          }
          obj.file = response.repositoryFileDto[i];
          obj.file.trash = "true";
          obj.file.pathText = jQuery.i18n.prop('originText') + " " //i18n
          if (obj.file.id) {
            if (myself.get("deletedFiles") == "") {
              myself.set("deletedFiles", obj.file.id + ",");
            } else {
              myself.set("deletedFiles", myself.get("deletedFiles") + obj.file.id + ",");
            }
          }
          newResp.children.push(obj);
        }
      }
      return newResp;
    },

    reformatResponse: function (response) {
      var newResp = {
        children: []
      }
      if (response && response.repositoryFileDto) {

        for (var i = 0; i < response.repositoryFileDto.length; i++) {
          var obj = {
            file: Object
          }

          obj.file = response.repositoryFileDto[i];
          obj.file.pathText = jQuery.i18n.prop('originText') + " " //i18n
          newResp.children.push(obj);
        }
      }
      return newResp;
    },

    updateData: function () {
      var myself = this;
      myself.set("runSpinner", true);
      myself.fetchData(myself.get("path"), function (response) {
        //If we have trash data we reformat it to match the handlebar templates
        if (myself.get("path") == ".trash") {
          var newResp = myself.reformatTrashResponse(myself, response);
          myself.set("data", newResp);
          if (myself.get("deletedFiles") == "") {
            FileBrowser.fileBrowserModel.get("trashButtons").onTrashSelect(true);
          }
        } else {
          var newResp = myself.reformatResponse(response);
          newResp.ts = new Date(); // force backbone to trigger onchange event even if response is the same
          myself.set("data", newResp);
        }
      });
    },

    fetchData: function (path, callback) {
      var myself = this,
          url = this.getFileListRequest(FileBrowser.encodePathComponents(path == null ? ":" : Encoder.encodeRepositoryPath(path))),
          localSequenceNumber = myself.get("sequenceNumber");
      $.ajax({
        async: true,
        cache: false, // prevent IE from caching the request
        dataType: "json",
        url: url,
        success: function (response) {
          if (localSequenceNumber == myself.get("sequenceNumber") && callback != undefined) {
            myself.set("sequenceNumber", localSequenceNumber + 1);
            callback(customSort(response));
          }

          if (window.parent.mantle_isBrowseRepoDirty == true) {
            window.parent.mantle_isBrowseRepoDirty = false;
            //clear the cache
            myself.set("cachedData", {});
          }
          //cache the folder contents
          if (FileBrowser.fileBrowserModel.getFolderClicked()) {
            if (FileBrowser.fileBrowserModel.getFolderClicked().attr("path") == ".trash") {
              myself.get("cachedData")[FileBrowser.fileBrowserModel.getFolderClicked().attr("path")]
                  = FileBrowser.fileBrowserModel.attributes.fileListModel.reformatTrashResponse(myself, response);
            }
            else {
              myself.get("cachedData")[FileBrowser.fileBrowserModel.getFolderClicked().attr("path")] = FileBrowser.
              fileBrowserModel.attributes.fileListModel.reformatResponse(response);
            }
          }
        },
        error: function () {
        },
        beforeSend: function (xhr) {
          myself.set("runSpinner", true);

          if (!window.parent.mantle_isBrowseRepoDirty) {
            if (myself.get("cachedData") != undefined) {
              if (myself.get("cachedData")[FileBrowser.fileBrowserModel.getFolderClicked().attr("path")] != undefined) {
                if (_.isEqual(myself.get("cachedData")[FileBrowser.fileBrowserModel.getFolderClicked().attr("path")], myself.get("data"))) {
                  myself.trigger('change:data');
                } else {
                  //force event in case data was not changed
                  myself.set("data", myself.get("cachedData")[FileBrowser.fileBrowserModel.getFolderClicked().attr("path")], {silent:true});
                  myself.trigger("change:data");
                }
                xhr.abort();
                if (myself.get("path") == ".trash" && myself.get("deletedFiles") == "") {
                  FileBrowser.fileBrowserModel.get("trashButtons").onTrashSelect(true);
                }
                myself.set("runSpinner", false);
              }
            }
          }

        }
      });
    },

    /*
     * Path has already been converted to colons
     */
    getFileListRequest: function (path) {
      var request;
      if (path == ".trash") {
        request = CONTEXT_PATH + "api/repo/files/deleted";
      }
      else {
        //request = CONTEXT_PATH + "api/repo/files/" + path + "/tree?depth=-1&showHidden=" + this.get("showHiddenFiles") + "&filter=*|FILES";
        request = CONTEXT_PATH + "api/repo/files/" + path + "/children?showHidden=" + this.get("showHiddenFiles") + "&filter=*%7CFILES";
      }
      return request;
    }
  });

  var FileBrowserView = Backbone.View.extend({
    attributes: {
      buttonsEnabled: false
    },

    initialize: function () {
      this.initializeLayout();
      this.initializeOptions();
      this.configureListeners();
      this.render();
    },

    configureListeners: function () {
      //update buttons when changed folder/file
      this.model.on("change:clickedFile", this.updateButtons, this);
      this.model.on("change:lastClick", this.updateButtons, this);

      //update buttons header on folder/file selection
      this.model.on("change:clickedFolder", this.updateButtonsHeader, this);
      this.model.on("change:clickedFile", this.updateButtonsHeader, this);

      //update folder and file browser headers on folder selection change
      this.model.on("change:clickedFolder", this.updateFolderBrowserHeader, this);
      this.model.on("change:clickedFolder", this.updateFileBrowserHeader, this);

      //check buttons enabled
      this.model.on("change:clickedFolder", this.checkButtonsEnabled, this);
      this.model.on("change:clickedFile", this.checkButtonsEnabled, this);
    },

    initializeLayout: function () {
      var myself = this;
      myself.$el.empty();
      myself.$el.append($(templates.structure({})));
    },

    initializeOptions: function () {
      var myself = this;

      foldersTreeView = undefined;
      fileListView = undefined;

      this.foldersTreeView = new FileBrowserFolderTreeView({
        model: myself.model.get("foldersTreeModel"),
        data: myself.model.get("foldersTreeModel").get("data"),
        el: myself.$el.find("#fileBrowserFolders .body")
      });

      this.fileListView = new FileBrowserFileListView({
        model: myself.model.get("fileListModel"),
        data: myself.model.get("fileListModel").get("data"),
        el: myself.$el.find("#fileBrowserFiles .body")
      });
    },

    render: function () {
      var myself = this;

      myself.updateButtons();
      myself.updateButtonsHeader();
      myself.updateFolderBrowserHeader();
      myself.updateFileBrowserHeader();

      //disable all buttons on start
      $("button.btn.btn-block").each(function () {
        $(this).attr("disabled", "disabled");
      });
    },

    updateButtonsHeader: function () {
      var myself = this,
          $buttonsContainer = myself.$el.find($("#fileBrowserButtons"));

      $buttonsContainer.find($(".header")).detach();

      var lastClick = myself.model.getLastClick(),
          folderClicked = myself.model.getFolderClicked(),
          fileClicked = myself.model.getFileClicked();

      var obj = {};

      if (lastClick == "file" && fileClicked != undefined) {
        obj.folderName = undefined;
        obj.fileName = $(fileClicked.find('.title')[0]).text();
      } else if (lastClick == "folder" && folderClicked != undefined) {
        obj.folderName = $(folderClicked.find('.title')[0]).text();
        obj.fileName = undefined;
      } else if ($(folderClicked).attr('path') == ".trash") {
        obj.trashHeader = jQuery.i18n.prop('trash_actions'); //i18n
      }
      obj.i18n = jQuery.i18n;
      //require buttons header template
      $buttonsContainer.prepend($(templates.buttonsHeader(obj)));
    },

    updateFolderBrowserHeader: function () {
      var $el = $(this.el),
          $folderBrowserContainer = $el.find($("#fileBrowserFolders"));

      $folderBrowserContainer.find($(".header")).detach();

      var folderClicked = this.model.getFolderClicked();
      var obj = {
        folderBreadcrumb: folderClicked && folderClicked.attr("path") ?
            folderClicked.attr("path").split("/").slice(1).join(" > ") : undefined,
        i18n: jQuery.i18n,
        refreshHandler: function () {
          if (window.parent.mantle_fireEvent) {
            window.parent.mantle_fireEvent('GenericEvent', {"eventSubType": "RefreshBrowsePerspectiveEvent",
              "booleanParam": FileBrowser.fileBrowserModel.get("showDescriptions") });
          }
        }
      };

      if (this.model.getLastClick() == "trash") {
        obj.trashHeader = jQuery.i18n.prop('browsing_trash'); //i18n
      }
      //require folders header template
      $folderBrowserContainer.prepend($(templates.folderBrowserHeader(obj)));
      if ($folderBrowserContainer.find("#refreshBrowserIcon").length > 0){
        a11yUtil.makeAccessibleActionButton($folderBrowserContainer.find("#refreshBrowserIcon")[0]);
      }
    },

    updateFileBrowserHeader: function () {
      var $el = $(this.el),
          $folderBrowserContainer = $el.find($("#fileBrowserFiles"));

      $folderBrowserContainer.find($(".header")).detach();

      var folderClicked = this.model.getFolderClicked();

      var obj = {
        folderName: folderClicked != undefined ? folderClicked.find("> .element .title").text() : undefined,
        i18n: jQuery.i18n
      }

      if (this.model.getLastClick() == "trash") {
        obj.trashHeader = jQuery.i18n.prop('trash_contents');
      }

      //require files header template
      $folderBrowserContainer.prepend($(templates.fileBrowserHeader(obj)));
    },

    updateButtons: function () {
      var $el = $(this.el),
          $buttonsContainer = $el.find($("#fileBrowserButtons .body"));

      $buttonsContainer.empty();
      var lastClick = this.model.getLastClick(),
          folderClicked = this.model.getFolderClicked(),
          fileClicked = this.model.getFileClicked();
      var buttonsType;
      if (lastClick == "file") {
        buttonsType = this.model.defaults.fileButtons;
      } else if (lastClick == "folder") {
        //convert path/title to arrays
        buttonsType = this.model.defaults.folderButtons;
      } else if (lastClick == "trash") {
        buttonsType = this.model.defaults.trashButtons;
      } else if (lastClick == "trashItem") {
        buttonsType = this.model.defaults.trashItemButtons;
      }

      var model = this.model; // trap model

      $buttonsContainer.append($(templates.buttons(buttonsType)));

      // add onClick handler to each button
      $(buttonsType.buttons).each(function (idx, fb) {
        $('#' + fb.id).on("click", { model: model, handler: fb.handler }, function (event) {
          var path = null;
          var title = null;
          var fileList = "";
          var id = "";
          var type = null;
          var mode = null;

          var multiSelectItems = FileBrowser.concatArray(model.get("fileListModel").get("multiSelect"), model.get("fileListModel").get("shiftLasso"));
          if (model.getLastClick() == "file") {
            path = $(model.getFileClicked()[0]).attr("path");
            title = $(model.getFileClicked()[0]).children('.title').text();
            id = $(model.getFileClicked()[0]).attr("id");
          } else if (model.getLastClick() == "folder") {
            path = $(model.getFolderClicked()[0]).attr("path");
            title = $(model.getFolderClicked()[0]).children('.title').text();
          } else if (model.getLastClick() == "trash") {
            fileList = model.get("fileListModel").get("deletedFiles");
            mode = "purge";
          } else if (model.getLastClick() == "trashItem") {
            for (var i = 0; i < multiSelectItems.length; i++) {
              fileList += multiSelectItems[i].obj.attr("id") + ",";
            }
            type ="file";
          }
          if ((path != null) && event.data.handler) {
            event.data.handler(path, title, id, multiSelectItems, model.get("browserUtils"));
            event.stopPropagation();
          } else {
            event.data.handler(fileList, type, mode);
            event.stopPropagation();
          }
        });
      });
      model.updateFolderButtons( folderClicked == undefined ? window.parent.HOME_FOLDER : folderClicked.attr("path") );
    },

    updateButtonsMulti: function () {
      var $el = $(this.el),
          $buttonsContainer = $el.find($("#fileBrowserButtons .body"));

      $buttonsContainer.empty();
      var lastClick = this.model.getLastClick(),
          folderClicked = this.model.getFolderClicked(),
          fileClicked = this.model.getFileClicked();

      var buttonsType = this.model.get("multiSelectButtons");

      var model = this.model; // trap model

      //require buttons template
      $buttonsContainer.append($(templates.buttons(buttonsType)));

      // add onClick handler to each button
      $(buttonsType.buttons).each(function (idx, fb) {
        $('#' + fb.id).on("click", { model: model, handler: fb.handler }, function (event) {
          var path = [];
          var title = [];
          var id = [];
          var fileList = null;
          var type = null;
          var mode = null;
          var returnModel = null;

          var multiSelectItems = FileBrowser.concatArray(model.get("fileListModel").get("multiSelect"), model.get("fileListModel").get("shiftLasso"));

          if (model.getLastClick() == "file") {
            for (var i = 0; i < multiSelectItems.length; i++) {
              path[i] = multiSelectItems[i].obj.attr("path");
              title[i] = multiSelectItems[i].obj.attr("title");
              id[i] = multiSelectItems[i].obj.attr("id");
            }
          } else if (model.getLastClick() == "folder") {
            path = $(model.getFolderClicked()[0]).attr("path");
            title = $(model.getFolderClicked()[0]).children('.title')
          } else if (model.getLastClick() == "trash") {
            fileList = model.get("fileListModel").get("deletedFiles");
            mode = "purge";
          } else if (model.getLastClick() == "trashItem") {
            fileList = $(model.getFileClicked()[0]).attr("id") + ",";
            type = $(model.getFileClicked()[0]).attr("type");
          }
          if ((path != null) && event.data.handler) {
            event.data.handler(path, title, id, multiSelectItems, model.get("browserUtils"));
            event.stopPropagation();
          } else {
            event.data.handler(fileList, type, mode);
            event.stopPropagation();
          }
        });
      });
    },

    checkButtonsEnabled: function () {
      //disable all buttons on start
      $("button.btn.btn-block[disabled=disabled]").each(function () {
        $(this).removeAttr("disabled");
      });
    }
  });


  var FileBrowserFolderTreeView = Backbone.View.extend({

    events: {
      "click .folder .expandCollapse": "expandFolder",

      "click .folder .icon": "clickFolder",
      "dblclick .folder .icon": "expandFolder",

      "click .folder .title": "clickFolder",
      "dblclick .folder .title": "expandFolder",

      "keydown .folder .element": "keyDownFolder",
    },

    initialize: function () {
      var myself = this,
          data = myself.model.get("data"),
          spinner = myself.model.get("spinner");

      myself.model.on("change:runSpinner", myself.manageSpinner, myself);
      myself.model.on("change:data", myself.render, myself);
      myself.model.on("change:showDescriptions", this.updateDescriptions, this);
      if (data == undefined) { //update data
        //start spinner
        myself.$el.html(spinner.spin());
        myself.model.set("updateData", true);
      }

    },

    render: function () {
      var myself = this,
          data = myself.model.get("data");

      //stop spinner
      myself.model.set("runSpinner", false);

      //append content
      myself.$el.append(templates.folders(data));


      //fix folder widths
      $(".folder").each(function () {
        $(this).addClass("selected");
      });

      $(".element").each(function () {
        var $this = $(this);

        //BISERVER-10784 - limit the amount of attempts to widen the column due to rendering
        //issues on google chrome
        var tries = 0;
        while ($this.height() > 20 && tries < 250) {
          $this.width($this.width() + 20);
          tries++;
        }
      });

      $(".folder").each(function () {
        $(this).removeClass("selected");
      });

      //close all children folders
      myself.$el.find(".folders").hide();

      //remove padding of first folder
      myself.$el.children().each(function () {
        $(this).addClass("first");
      });

      //hide expand button from trash
      $(".trash").addClass("empty");

      // Checks if any folder is visible
      var $firstVisibleFolder = myself.getFirstVisibleFolder();

      if( $firstVisibleFolder ) {
        // open last clicked folder or start folder (home folder)
        // if startFolder is not visible, use first one that it is instead
        var $folder = undefined;

        // verify if clicked folder is visible
        if ( FileBrowser.fileBrowserModel.getFolderClicked() &&
            FileBrowser.fileBrowserModel.getFolderClicked().attr("path") &&
            ( $( "div[path='" + FileBrowser.fileBrowserModel.getFolderClicked().attr("path") + "']" ).length !== 0 ) ) {
          $folder = $("[path='" + FileBrowser.fileBrowserModel.getFolderClicked().attr("path") + "']");
        } else if ( FileBrowser.fileBrowserModel.get("startFolder") &&
            ( $( "div[path='" + FileBrowser.fileBrowserModel.get("startFolder") + "']" ).length !== 0 ) ) {
          $folder = $( "[path='" + FileBrowser.fileBrowserModel.get("startFolder") + "']" );
        } else {
          $folder = myself.getFirstVisibleFolder();
        }

        var $parentFolder = $folder.parent(".folders");
        while (!$parentFolder.hasClass("body") && $parentFolder.length > 0) {
          $parentFolder.show();
          $parentFolder.parent().addClass("open");
          $parentFolder = $parentFolder.parent().parent();
        }
        FileBrowser.fileBrowserModel.set("clickedFolder", {
          obj: $folder,
          time: (new Date()).getTime()
        });
        var $clickedFile = FileBrowser.fileBrowserModel.getFileClicked();
        if ($clickedFile != undefined && FileBrowser.fileBrowserModel.getLastClick() == "file") {
          FileBrowser.fileBrowserModel.get("fileListModel").set("clickedFile", {
            obj: FileBrowser.fileBrowserModel.getFileClicked(),
            time: (new Date()).getTime()
          });
          FileBrowser.fileBrowserModel.updateFileClicked();
          $folder.addClass("secondarySelected");
          $folder.children(".element").attr("tabindex", 0).attr("aria-selected", true);
          $folder.removeClass("selected");
          $clickedFile.addClass("selected");
        } else {
          $folder.addClass("open");
          $folder.children(".element").attr("aria-expanded", true);
          $folder.addClass("selected");
          $folder.children(".element").attr("tabindex", 0).attr("aria-selected", true);
          $folder.find("> .folders").show();
        }
        FileBrowser.fileBrowserModel.updateFolderButtons($folder.attr("path"));
        myself.updateDescriptions();
      }
    },

    getFirstVisibleFolder: function () {
      var myself = this;
      var firstVisibleFolder = undefined;
      var foldersList = myself.model.get( "data" ).children;

      for ( var i = 0; i < foldersList.length; i++ ) {
        var elem = foldersList[i];
        if (elem && elem.file && elem.file.folder && elem.file.path &&
          $("div[path=\"" + elem.file.path + "\"]").length != 0) {
          firstVisibleFolder = elem;
          break;
        }
      }

      if ( firstVisibleFolder ) {
        return $( "[path='" + firstVisibleFolder.file.path + "']" );
      }
    },

    expandFolder: function (event) {
      let $target;
      if ($(event.currentTarget).hasClass("element")) {
        $target = $(event.currentTarget).parent();
      } else {
        $target = $(event.currentTarget).parent().parent();
      }

      if($target.hasClass("trash")){
        //ignore expand events for trash
        event.stopPropagation();
        return;
      }

      // If target has class open, it is already opened and showing children...close it and hide children
      if ($target.hasClass("open")) {
        $target.children(".element").attr("aria-expanded", false);
        $target.removeClass("open").find("> .folders").hide();
        if ($target.find("[tabindex=0]").length > 0) {
          $target.find("[tabindex=0]").attr("tabindex", -1);
          $target.children(".element").attr("tabindex", 0);
        }
      // Else if the children are already part of the DOM, there is no need to make a rest call to get them
      // Simply add .open class to target, and show children (we've already made a call to get them)
      } else if ($target.find("> .folders").children().length > 0) {
        $target.children(".element").attr("aria-expanded", true);
        $target.addClass("open").find("> .folders").show();
      // else, we must make a call to get the children of the target folder (if they exist) and add them to DOM
      } else {
        var path = $target.attr("path");
        var myself = this;

        var url = CONTEXT_PATH + "api/repo/files/" +
            FileBrowser.encodePathComponents(path == null ? ":" : Encoder.encodeRepositoryPath(path))
            + "/tree?depth=1&showHidden=" + myself.model.get("showHiddenFiles") + "&filter=*%7CFOLDERS";
        $.ajax({
          async: true,
          cache: false, // prevent IE from caching the request
          dataType: "json",
          url: url,
          success: function (response) {
            if (response.children) {
              var toAppend = "";
              for(var i = 0; i < response.children.length; i++) {
                var child = response.children[i].file;
                toAppend += "<div id=\"" + child.id + "\" class=\"folder\" path=\"" + child.path +
                    "\" ext=\"" + child.name + "\" desc=\"" + child.name + "\">" +
                    "<div class=\"element\" role='treeitem' aria-selected='false' aria-expanded='false' tabindex='-1'>" +
                    "<div class=\"expandCollapse\"></div>" +
                    "<div class=\"icon\"></div>" +
                    "<div class=\"title\">" + ( child.title ? child.title : child.name ) + "</div>" +
                    "</div>" +
                    "<div class=\"folders\" style=\"\"></div>" +
                    "</div>"
              }
              $target.find("> .folders").append(toAppend ? toAppend : "");
              depth = $target.attr("path").split("/").length;
            }
            // set the widths of new folder descriptions
            $target.find(".element").each(function () {
              var $this = $(this);
              var tries = 0;
              while ($this.height() > 20 && tries < 250) {
                $this.width($this.width() + 20);
                tries++;
              }
            });
            $target.children(".element").attr("aria-expanded", true);
            $target.addClass("open").find("> .folders").show();
          },
          error: function () {
          },
          beforeSend: function (xhr) {
          }
        });
      }
      event.stopPropagation();
    },

    clickFolder: function (event) {
      let $target;
      if ($(event.currentTarget).hasClass("element")) {
        $target = $(event.currentTarget).parent();
      } else {
        $target = $(event.currentTarget).parent().parent();
      }
      //BISERVER-9259 - added time parameter to force change event
      this.model.set("clicked", {
        obj: $target.attr("id"),
        time: (new Date()).getTime()
      });
      this.model.set("clickedFolder", {
        obj: $target,
        time: (new Date()).getTime()
      });
      $(".folder.selected").children(".element").attr("tabindex", -1).attr("aria-selected", false);
      $(".folder.selected").removeClass("selected");
      $(".folder.secondarySelected").removeClass("secondarySelected");
      $(".folder").find("[tabindex=0]").attr("tabindex", -1);
      $target.addClass("selected");
      $target.children(".element").attr("tabindex", 0).attr("aria-selected", true);
      //deselect any files
      $(".file.selected").removeClass("selected");
      depth = $target.attr("path").split("/").length;
      event.stopPropagation();
    },

    keyDownFolder: function (event) {
      let keyCode = event.which || event.keyCode;
      if (keyCode === a11yUtil.keyCodes.enter || keyCode === a11yUtil.keyCodes.space) {
        // ENTER , SPACE
        this.clickFolder(event);
      } else if (keyCode === a11yUtil.keyCodes.arrowDown) {
        // DOWN Arrow
        let nextElement = this.getNextElementToFocus($(event.currentTarget));
        if (nextElement !== null) {
          nextElement.focus();
        }
      } else if (keyCode === a11yUtil.keyCodes.arrowUp) {
        // UP Arrow
        let prevElement = this.getPreviousElementToFocus($(event.currentTarget));
        if (prevElement !== null) {
          prevElement.focus();
        }
      } else if (keyCode === a11yUtil.keyCodes.arrowRight) {
        // RIGHT Arrow
        if (!$(event.currentTarget).parent().hasClass("open")) {
          this.expandFolder(event);
        }
      } else if (keyCode === a11yUtil.keyCodes.arrowLeft) {
        // LEFT Arrow
        if ($(event.currentTarget).parent().hasClass("open")) {
          this.expandFolder(event);
        }
      }
      event.stopPropagation();
    },

    getNextElementToFocus: function (currentElement) {
      let lastFolder = $("#fileBrowserFolders").find(".folder").last();
      let firstChildFolder = currentElement.next().children().first();

      if (currentElement.parent().hasClass("open") && firstChildFolder.length > 0) {
        return firstChildFolder.children(".element");
      }
      return this.getNextAvailableElement(currentElement.parent(), lastFolder);
    },

    getNextAvailableElement: function (currentFolder, lastFolder) {
      if (currentFolder.attr("title") === lastFolder.attr("title")) {
        return null;
      }

      if (currentFolder.next().length > 0) {
        return currentFolder.next().children(".element");
      } else {
        return this.getNextAvailableElement(currentFolder.parent().parent(), lastFolder);
      }
    },

    getPreviousElementToFocus: function (currentElement) {
      let previousFolder = currentElement.parent().prev();

      if (previousFolder.length === 0) {
        let rootFolder = $("#fileBrowserFolders").find(".folder").first();
        if (rootFolder.attr("id") === currentElement.parent().attr("id")) {
          return null;
        }
        return currentElement.parent().parent().parent().children(".element");
      } else {
        return this.getPreviousAvailableElement(previousFolder);
      }
    },

    getPreviousAvailableElement: function (currentFolder) {
      let currentFolderChildren = currentFolder.children(".folders").children();

      if (currentFolder.hasClass("open") && currentFolderChildren.length > 0) {
        return this.getPreviousAvailableElement(currentFolderChildren.last())
      }
      return currentFolder.children(".element");
    },

    manageSpinner: function () {
      var myself = this,
          runSpinner = this.model.get("runSpinner"),
          spinner = this.model.get("spinner");

      if (runSpinner) {
        if (spinner != undefined) {
          myself.$el.html(spinner.spin().el);
        } else {  }
      } else {
        myself.model.get("spinner").stop();
      }
    },

    updateDescriptions: function () {
      var $folders = $(".folder"),
          showDescriptions = this.model.get("showDescriptions");

      $folders.each(function () {
        var $this = $(this);
        var desc = $this.attr("desc");
        if (showDescriptions && desc != "") {
          $this.attr("title", desc);
        } else {
          $this.attr("title", $this.attr("ext"));
        }
      });
    }
  });

  var FileBrowserFileListView = Backbone.View.extend({
    events: {
      "click option.file": "clickFile",
      "dblclick option.file": "doubleClickFile",
      "click": "clickBody",
      "keydown": "keyDownFile"
    },

    initialize: function () {
      var myself = this,
          data = myself.model.get("data");
      this.model.on("change:data", this.updateFileList, this);
      myself.model.on("change:runSpinner", myself.manageSpinner, myself);
      myself.model.on("change:showDescriptions", this.updateDescriptions, this);
    },

    render: function () {
      var myself = this,
          data = myself.model.get("data");

      //require file list template
      myself.$el.empty().append(templates.files(data));

      if (myself.$el.children().length > 0) {
        $(".file").each(function () {
          var $this = $(this);

          //BISERVER-10784 - limit the amount of attempts to widen the column due to rendering
          //issues on google chrome
          var tries = 0;
          while ($this.height() > 20 && tries < 250) {
            $this.width($this.width() + 20);
            tries++;
          }
        });
      } else {
        myself.$el.append(templates.emptyFolder({i18n: jQuery.i18n}));
      }

      myself.updateDescriptions();
      var fileSelected = false;
      if ( myself.model.attributes.clickedFile ){
        var filelist = myself.$el.children();
        for (index = 0; index < filelist.length; ++index) {
          if ( $(myself.$el.children().get(index)).attr("path") == myself.model.attributes.clickedFile.obj.attr("path") ) {
            $(myself.$el.children().get(index)).addClass("selected");
            fileSelected = true;
          }
        }
      }
      //could not find file, select folder for file
      if (!fileSelected) {
        var $folder = $(".folder.secondarySelected");
        if ($folder.length > 0) {
          $folder.addClass("selected");
          $folder.removeClass("secondarySelected");
          FileBrowser.fileBrowserModel.updateFolderLastClick();
          FileBrowser.FileBrowserView.updateButtonsHeader();
        }
      }
      setTimeout(function () {
        myself.model.set("runSpinner", false);
      }, 100);
    },

    keyDownFile: function (event) {
      let keyCode = event.which || event.keyCode;
      if ( ( keyCode === a11yUtil.keyCodes.enter || keyCode === a11yUtil.keyCodes.space ) &&
        $(event.currentTarget).find(":selected").length > 0 ){
        this.clickFile(event);
      }
    },
    clickFile: function (event) {
      var prevClicked = this.model.get("clickedFile");
      if (this.model.get("anchorPoint")) {
        prevClicked = this.model.get("anchorPoint");
      }

      //don't want to stop propagation of the event, but need to notify clickBody listener
      //that the event was handled and we don't need to deselect a file
      this.model.set("desel", 1);
      let $target;
      if ($(event.currentTarget).is("select")){
        $target = $(event.currentTarget).find(":selected");
      }else {
        $target = $(event.currentTarget).eq(0);
      }

      //BISERVER-9259 - added time parameter to force change event
      this.model.set("clicked", {
        obj: $target,
        time: (new Date()).getTime()
      });

      this.model.set("clickedFile", {
        obj: $target,
        time: (new Date()).getTime()
      });

      if (!event.shiftKey) {
        this.model.set("anchorPoint", this.model.get("clickedFile"));
      }

      //Control Click
      if (event.ctrlKey || event.metaKey) {
        //Control click will reset the shift lasso and merge its contents into main array
        this.model.set("multiSelect", FileBrowser.concatArray(this.model.get("multiSelect"), this.model.get("shiftLasso")));
        this.model.set("shiftLasso", []);

        //If item is already selected, deselect it.
        var clickedFileIndex = -1;
        var index;
        for (index = 0; index < this.model.get("multiSelect").length; ++index) {
          var clickedFileId = this.model.get("clickedFile").obj.attr("id")
          var multiSelectId = this.model.get("multiSelect")[index].obj.attr("id");
          if (clickedFileId == multiSelectId) {
            clickedFileIndex = index;
            break;
          }
        }

        //We are cntrl clicking an existing selection
        if (clickedFileIndex > -1) {
          this.model.get("multiSelect").splice(clickedFileIndex, 1);
          //Remove selected style from deselected item
          $target.removeClass("selected");
        }
        //We are cntrl clicking a new selection
        else {
          FileBrowser.pushUnique(this.model.get("multiSelect"), this.model.get("clickedFile"));
          $target.addClass("selected");
        }
        //Shift Click
      } else if (event.shiftKey) {
        //reset lasso file selected styles
        for (var i = 0; i < this.model.get("shiftLasso").length; i++) {
          this.model.get("shiftLasso")[i].obj.removeClass("selected");
        }
        //Clear the Lasso array
        this.model.set("shiftLasso", []);
        $target.addClass("selected");
        prevClicked.obj.addClass("selected");

        if (prevClicked.obj.attr("id") != $target.attr("id")) {
          //Model title
          this.model.get("data").children[0].file.title;
          var files = this.model.get("data").children;
          var inRange = false;
          var secondMatch = false;
          for (var i = 0; i < files.length; i++) {
            if (files[i].file.folder === "false") {
              if ((files[i].file.id == prevClicked.obj.attr("id") || files[i].file.id == $target.attr("id"))) {
                if (inRange == true) {
                  secondMatch = true;
                } else {
                  inRange = true;
                }
              }
              if (inRange == true) {
                var item = {
                  obj: $("option[id=\"" + files[i].file.id + "\"]")
                }
                item.obj.addClass("selected");
                FileBrowser.pushUnique(this.model.get("shiftLasso"), item);
                if (secondMatch) {
                  inRange = false;
                }
              }
            }
          }
        }
        //target title
        $target.attr("title");
        //prev Clicked title
        prevClicked.obj.attr("title");
        //Single Click
      } else {
        //Clear the multiselect array
        this.model.set("multiSelect", []);
        this.model.set("shiftLasso", []);
        FileBrowser.pushUnique(this.model.get("multiSelect"), this.model.get("clickedFile"));

        //reset all file selected styles
        $(".file.selected").removeClass("selected");
        $target.addClass("selected");
      }

      var tempModel = [];
      $(".file.selected").each(function (i, ele) {
        tempModel.push({obj: $(ele)});
      });

      this.model.set("multiSelect", tempModel);
      //If more than one file is selected add multiselect button options
      if (!(this.model.get("path") == ".trash") && this.model.get("multiSelect").length > 1) {
        FileBrowser.FileBrowserView.updateButtonsMulti();
      }
      //Add secondary selection to folder
      $(".folder.selected").addClass("secondarySelected");
      $(".folder.selected").removeClass("selected");
    },

    doubleClickFile: function (event) {
      var path = $(event.currentTarget).attr("path");
      //if not trash item, try to open the file.
      if (FileBrowser.fileBrowserModel.getLastClick() != "trashItem") {
        this.model.get("openFileHandler")(path, "run");
      }
    },

    clickBody: function (event) {
      if(!this.model.get("desel")){
        $(".file.selected").removeClass("selected");
        if(FileBrowser.fileBrowserModel.getLastClick() == 'file'){
          FileBrowser.fileBrowserModel.set("lastClick", "folder");
          $(".file.selected").removeClass("selected");
          $(".folder.secondarySelected").addClass("selected");
          $(".folder.secondarySelected").removeClass("secondarySelected");
          FileBrowser.FileBrowserView.updateButtonsHeader();
        }
      }
      this.model.set("desel", 0);
    },

    updateFileList: function () {
      var myself = this;
      this.render();

      setTimeout(function () {
        myself.model.set("runSpinner", false);
      }, 100);
    },

    manageSpinner: function () {
      var myself = this,
          runSpinner = this.model.get("runSpinner"),
          spinner = this.model.get("spinner");

      if (runSpinner) {
        if (spinner != undefined) {
          myself.$el.html(spinner.spin().el);
        } else {

        }
      } else {
        myself.model.get("spinner").stop();
      }
    },

    updateDescriptions: function () {
      var $files = $(".file"),
          showDescriptions = this.model.get("showDescriptions");

      $files.each(function () {
        var $this = $(this);
        var desc = $this.attr("desc");
        if (showDescriptions && desc != "") {
          $this.attr("title", desc);
        }
        else {
          $this.attr("title", $this.attr("ext"));
        }
      });

    }

  });

  function customSort(response) {

    var sortFunction = function (a, b) {
      return window.parent.localeCompare(a.file.title, b.file.title);
    };

    var recursivePreorder = function (node) {
      if (node != undefined) {
        if (node.children == undefined || node.children == null || node.children.length <= 0) {
          // do nothing if node is not a parent
        }
        else {
          for (var i = 0; i < node.children.length; i++)
              // recursively sort children
            recursivePreorder(node.children[i]);
          node.children.sort(sortFunction);
        }
      }
    };

    if (!window.parent.localeCompare) {
      console.log('window.parent.localeCompare function has not been loaded');
      return response; // the server should still return a sorted tree list
    }

    recursivePreorder(response);

    return response;
  }

  return {
    encodePathComponents: FileBrowser.encodePathComponents,
    setContainer: FileBrowser.setContainer,
    setOpenFileHandler: FileBrowser.setOpenFileHandler,
    setShowHiddenFiles: FileBrowser.setShowHiddenFiles,
    setShowDescriptions: FileBrowser.setShowDescriptions,
    setCanDownload: FileBrowser.setCanDownload,
    setCanPublish: FileBrowser.setCanPublish,
    setCanRead: FileBrowser.setCanRead,
    setCanCreate: FileBrowser.setCanCreate,
    updateShowDescriptions: FileBrowser.updateShowDescriptions,
    update: FileBrowser.update,
    updateData: FileBrowser.updateData,
    updateFile: FileBrowser.updateFile,
    updateFolder: FileBrowser.updateFolder,
    redraw: FileBrowser.redraw,
    templates: FileBrowser.templates,
    openFolder: FileBrowser.openFolder,
    pushUnique: FileBrowser.pushUnique,
    concatArray: FileBrowser.concatArray
  }
});

function perspectiveActivated() {
  window.parent.mantle_isBrowseRepoDirty = true;
  FileBrowser.update(FileBrowser.fileBrowserModel.getFolderClicked().attr("path"));
}
