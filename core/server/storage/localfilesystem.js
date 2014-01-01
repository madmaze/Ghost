// # Local File System Image Storage module
// The (default) module for storing images, using the local file system

var _       = require('underscore'),
    express = require('express'),
    fs      = require('fs-extra'),
    im      = require('imagemagick'),
    nodefn  = require('when/node/function'),
    path    = require('path'),
    when    = require('when'),
    errors  = require('../errorHandling'),
    config  = require('../config'),
    baseStore   = require('./base'),

    localFileStore;

localFileStore = _.extend(baseStore, {
    // ### Save
    // Saves the image to storage (the file system)
    // - image is the express image object
    // - returns a promise which ultimately returns the full url to the uploaded image
    'save': function (image) {
        var saved = when.defer(),
            targetDir = this.getTargetDir(config.paths().imagesRelPath),
            targetFilename;

        this.getUniqueFileName(this, image.name, targetDir).then(function (filename) {
            targetFilename = filename;
            // Make Dir if it doesnt already exist
            return nodefn.call(fs.mkdirs, targetDir);
        }).then(function () {
            // Move the image to the targetDir
            return nodefn.call(fs.copy, image.path, targetFilename);
        }).then(function () {
            // Delete the image from temp location
            return nodefn.call(fs.unlink, image.path).otherwise(errors.logError);
        }).then(function () {
            // The src for the image must be in URI format, not a file system path, which in Windows uses \
            // For local file system storage can use relative path so add a slash
            var fullUrl = (config.paths().webroot + '/' + targetFilename).replace(new RegExp('\\' + path.sep, 'g'), '/');
            return saved.resolve(fullUrl);
        }).then(function () {
            return baseStore.getUniqueFileName(baseStore, "t_" + image.name, targetDir).then( function (thumbName) {
                // Downsize image for page-load speed and bandwidth optimization
                // Note: The height arg of '\>' gets passed through to imagemagick to only shrink larger images
                return nodefn.call(im.resize, {srcPath: targetFilename, dstPath: thumbName, width: 1024, height: '\>'});
            });
        }).otherwise(function (e) {
            errors.logError(e);
            return saved.reject(e);
        });

        return saved.promise;
    },

    'exists': function (filename) {
        // fs.exists does not play nicely with nodefn because the callback doesn't have an error argument
        var done = when.defer();

        fs.exists(filename, function (exists) {
            done.resolve(exists);
        });

        return done.promise;
    },

    // middleware for serving the files
    'serve': function () {
        return express['static'](config.paths().imagesPath);
    }
});

module.exports = localFileStore;
