var Q = require('q'); 
var childProcess = require('child_process'); 
var asar = require('asar'); 
var jetpack = require('fs-jetpack');
var projectDir;
var buildDir; 
var manifest; 
var appDir;

function init() { 
    // Project directory is the root of the application
    projectDir = jetpack; 
    // Build directory is our destination where the final build will be placed 
    buildDir = projectDir.dir('./dist', { empty: true }); 
    // angular application directory 
    appDir = projectDir.dir('./build'); 
    // angular application's package.json file 
    manifest = appDir.read('./package.json', 'json'); 
    return Q(); 
} 

function copyElectron() { 
     return projectDir.copyAsync('./node_modules/electron-prebuilt/dist', buildDir.path(), { overwrite: true }); 
} 

function cleanupRuntime() { 
     return buildDir.removeAsync('resources/default_app'); 
} 

function createAsar() { 
     var deferred = Q.defer(); 
     asar.createPackage(appDir.path(), buildDir.path('resources/app.asar'), function () { 
         deferred.resolve(); 
     }); 
     return deferred.promise; 
} 

function updateResources() {
    var deferred = Q.defer();

    // Copy your icon from resource folder into build folder.
    projectDir.copy('resources/windows/icon.ico', buildDir.path('icon.ico'));

    // Replace Electron icon for your own.
    var rcedit = require('rcedit');
    rcedit(buildDir.path('electron.exe'), {
        'icon': projectDir.path('resources/windows/icon.ico'),
        'version-string': {
            'ProductName': "Easybasic",
            'FileDescription': "An IDE for GwBasic",
        }
    }, function (err) {
        if (!err) {
            deferred.resolve();
        }
    });
    return deferred.promise;
}
//Rename the electron exe 
function rename() {
    return buildDir.renameAsync('electron.exe', "Easybasic" + '.exe');
}

function createInstaller() {
    var deferred = Q.defer();

    function replace(str, patterns) {
        Object.keys(patterns).forEach(function (pattern) {
            console.log(pattern)
              var matcher = new RegExp('{{' + pattern + '}}', 'g');
            str = str.replace(matcher, patterns[pattern]);
        });
        return str;
    }

    var installScript = projectDir.read('resources/windows/installer.nsi');

    installScript = replace(installScript, {
        name: "Easybasic",
        productName: "Easybasic",
        version: "1.0.0.0",
        src: buildDir.path(),
        dest: projectDir.path(),
        icon: buildDir.path('icon.ico'),
        setupIcon: buildDir.path('icon.ico'),
        banner: projectDir.path('resources/windows/banner.bmp'),
    });
    buildDir.write('installer.nsi', installScript);

    var nsis = childProcess.spawn("C:\\Program Files (x86)\\NSIS\\makensis.exe", [buildDir.path('installer.nsi')], {
        stdio: 'inherit'
    });

    nsis.on('error', function (err) {
        if (err.message === 'spawn makensis ENOENT') {
            throw "Can't find NSIS. Are you sure you've installed it and"
            + " added to PATH environment variable?";
        } else {
            throw err;
        }
    });

    nsis.on('close', function () {
        deferred.resolve();
    });

    return deferred.promise;

}

function build() { 
    return init()
            .then(copyElectron) 
            .then(cleanupRuntime) 
            .then(createAsar) 
            .then(updateResources) 
            .then(rename) 
            .then(createInstaller); 
    }
    module.exports = { build: build };