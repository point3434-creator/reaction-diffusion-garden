  var gardenSongStore = (function () {
    var database;

    function open() {
      if (!database) database = new Promise(function (resolve, reject) {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('Song storage is unavailable in this browser.'));
          return;
        }
        var request = indexedDB.open('garden-song-library', 1);
        request.onupgradeneeded = function () {
          request.result.createObjectStore('songs', { keyPath: 'id' });
        };
        request.onerror = function () { reject(request.error); };
        request.onsuccess = function () {
          var db = request.result;
          db.onversionchange = function () { db.close(); database = null; };
          resolve(db);
        };
      });
      return database;
    }

    function run(mode, operation) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var transaction = db.transaction('songs', mode);
          var request = operation(transaction.objectStore('songs'));
          request.onerror = function () { reject(request.error); };
          transaction.onerror = function () { reject(transaction.error || request.error); };
          transaction.onabort = function () {
            reject(transaction.error || new DOMException('Song storage transaction aborted.', 'AbortError'));
          };
          transaction.oncomplete = function () {
            resolve(mode === 'readonly' ? request.result : undefined);
          };
        });
      });
    }

    return {
      load: function () {
        return run('readonly', function (store) { return store.getAll(); }).then(function (records) {
          return records.map(function (record) { return { filename: record.filename, blob: record.blob }; });
        });
      },
      put: function (file) {
        return run('readwrite', function (store) {
          return store.put({ id: file.name.toLowerCase(), filename: file.name, blob: file });
        });
      },
      remove: function (filename) {
        return run('readwrite', function (store) { return store.delete(filename.toLowerCase()); });
      }
    };
  })();
