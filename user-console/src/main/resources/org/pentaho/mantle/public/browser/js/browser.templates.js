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
  "common-ui/handlebars",
  "pentaho/shim/css.escape"
], function () {
  var templates = {};

  Handlebars.registerHelper('stringifyFunc', function (fn) {
    return "(" + fn.toString().replace(/\"/g, "'") + ")()";
  });

  //main component structure
  templates.structure = Handlebars.compile(
      "<div id='fileBrowserFolders' class='span4 well fileBrowserColumn fileBrowserFolders'>" +
          "<div class='body' role='tree' aria-labelledby='foldersHeader'></div>" +
          "</div>" +
          "<div id='fileBrowserFiles' class='span4 well fileBrowserColumn fileBrowserFiles'>" +
          "<select class='body' aria-labelledby='filesHeader' multiple size='0'></select>" +
          "</div>" +
          "<div id='fileBrowserButtons' class='span4 well fileBrowserColumn fileBrowserButtons'>" +
          "<div class='body'></div>" +
          "</div>");

  //header for folder browser
  templates.folderBrowserHeader = Handlebars.compile(
      "{{#if trashHeader}}" +
          "<div id='foldersHeader' class='header'>{{trashHeader}}</div>" +
          "{{else}}" +
          "<div id='foldersHeader' class='header'>" +
          "<span>{{i18n 'folders'}}</span>" +
          "<div id='refreshBrowserIcon' class='refresh-browse-perspective pull-right'" +
          "title={{i18n 'refresh'}} onclick='{{stringifyFunc refreshHandler}}'>" +
          "</div>" +
          "</div>" +
          "{{/if}}");

  //header for file browser
  templates.fileBrowserHeader = Handlebars.compile(
      "{{#if trashHeader}}" +
          "<div id='filesHeader' class='header'>{{trashHeader}}</div>" +
          "{{else}}" +
          "<div id='filesHeader' class='header'>{{i18n 'files'}}</div>" +
          "{{/if}}");

  //header for buttons
  templates.buttonsHeader = Handlebars.compile(
      "{{#if trashHeader}}" +
          "<div id='buttonsHeader' class='header'>{{trashHeader}}</div>" +
          "{{else}}" +
          "{{#if fileName}}" +
          "<div id='buttonsHeader' class='header'>{{i18n 'fileActions'}}</div>" +
          "{{else}}" +
          "<div id='buttonsHeader' class='header'>{{i18n 'folderActions'}}</div>" +
          "{{/if}}" +
          "{{/if}}");

  //button template
  templates.button = Handlebars.compile(
      "{{#if predicate}}" +
          "<div class='separator'></div>" +
          "{{else}}" +
          "{{#if optional}}" +
          "<div id='optional-separator' class='separator'></div>" +
          "{{else}}" +
          "<button id='{{id}}' class='btn btn-block' onclick={{handler}}''>{{text}}</button>" +
          "{{/if}}" +
          "{{/if}}");

  //buttons template to create list of buttons based on one object
  templates.buttons = Handlebars.compile("{{#each buttons}}{{button}}{{/each}}");

  //folder template with recursive behavior
  templates.folderText =
      "{{#ifCond file.folder 'true'}}" +
          "{{#ifCond file.path '.trash'}}" +
          "<div id='{{file.id}}' class='trash folder' path='{{file.path}}' ext='{{file.name}}' desc='{{file.name}}'>" +
          "{{else}}" +
          "<div id='{{file.id}}' class='folder' path='{{file.path}}' desc='{{file.description}}' ext='{{file.name}}'>" +
          "{{/ifCond}}" +
          "<div class='element' role='treeitem' aria-selected='false' aria-expanded='false' tabindex='-1'>" +
          "<div class='expandCollapse'> </div>" +
          "<div class='icon'> </div>" +
          "{{#if file.title}}" +
          "<div class='title'>{{file.title}}</div>" +
          "{{else}}" +
          "<div class='title'>{{file.name}}</div>" +
          "{{/if}}" +
          "</div>" +
          "<div class='folders' role='group'>" +
          "{{#each children}} {{> folder}} {{/each}}" +
          "</div>" +
          "</div>" +
          "{{/ifCond}}";

  //folders recursion
  templates.foldersText = "{{#each children}} {{> folder}} {{/each}}";

  //file template
  templates.file = Handlebars.compile(
      "{{#ifCond folder 'false' }}" +
          "{{#if trash}}" +
          "<option id='{{id}}' class='file icon {{classes}}' origPath='{{origPath}}' path='{{path}}' type='file' ext='{{trashPath}}' title='{{trashPath}}'>" +
          "{{else}}" +
          "<option id='{{id}}' class='file icon {{classes}}' path='{{path}}' type='file' desc='{{description}}' ext='{{fileWithExtension}}'>" +
          "{{/if}}" +
          "<div class='title'>{{title}}</div>" +
          "</option>" +
          "{{/ifCond}}" +
          "{{#ifCond trash 'true'}}" +
          "{{#ifCond folder 'true'}}" +
          "<option id='{{id}}' class='file icon trashFolder' origPath='{{trashPath}}' path='{{path}}' type='folder' ext='{{trashPath}}' title='{{trashPath}}'>" +
          "<div class='title'>{{title}}</div>" +
          "</option>" +
          "{{/ifCond}}" +
          "{{/ifCond}}");

  //files template to create list of files based on one object
  templates.files = Handlebars.compile("{{#each children}} {{file}} {{/each}}");

  //templates for folders creation
  templates.folders = Handlebars.compile(templates.foldersText);
  templates.folder = Handlebars.compile(templates.folderText);

  //template for empty folder
  templates.emptyFolder = Handlebars.compile("<option class='emptyFolder' disabled>{{i18n 'emptyFolder'}}</option>");

  //helper registration for button template
  Handlebars.registerHelper('button', function () {
    return new Handlebars.SafeString(templates.button({
      id: this.id,
      text: this.text,
      predicate: (this.id == "separator"),
      optional: (this.id == "optional-separator")
    }));
  });

  Handlebars.registerHelper('i18n',
      function (str) {
        return (this.i18n != undefined ? this.i18n.prop(str) : str);
      }
  );

  //helper registration for file template
  Handlebars.registerHelper('file', function () {
    //handle file name
    var name = this.file.name,
        title = this.file.title,
        path = this.file.path;


    var correctName = (name == "" ? path : name);

    var lastIndex = correctName.lastIndexOf('.'),
        nameNoExtension = correctName.substr(0, lastIndex),
        extension = CSS.escape(correctName.substr(lastIndex + 1, correctName.length));

    return new Handlebars.SafeString(templates.file({
      path: path,
      trash: this.file.trash,
      trashPath: (this.file.name.charAt(0) == "/") ? this.file.pathText + this.file.originalParentFolderPath + this.file.name : this.file.pathText + this.file.originalParentFolderPath + "/" + this.file.name,
      name: nameNoExtension,
      title: title,
      id: this.file.id,
      classes: extension,
      description: this.file.description,
      folder: this.file.folder,
      fileWithExtension: this.file.name
    }));
  });

  //partial registration (essential for folder recursive method)
  Handlebars.registerPartial('folder', templates.folderText);


  //extra helpers
  Handlebars.registerHelper('ifCond', function (v1, v2, options) {
    if (v1 == v2) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  //return object
  return {
    structure: templates.structure,
    folderBrowserHeader: templates.folderBrowserHeader,
    fileBrowserHeader: templates.fileBrowserHeader,
    buttonsHeader: templates.buttonsHeader,
    buttons: templates.buttons,
    folders: templates.folders,
    files: templates.files,
    emptyFolder: templates.emptyFolder
  }
});
