var data = { 'test': { 'a.txt': { mime: 'text/plain', content: 'a.contents' } } };

function find(path) {
  return path.replace(/[^\.\-_A-Za-z0-9\/]/g, '').split('/').reduce(function (data, name) {
    if (name === "") return data;
    // console.log('fnd:', Object.keys(data), name);
    return data[name];
  }, data);
}


function getSingleProp(obj, name) {
    if (name === "getlastmodified") {
      return (new Date()).toUTCString();
    }
    if (name === "creationdate") {
      return (new Date(0)).toUTCString();
    }
    if (name === "resourcetype") {
      return obj && typeof obj.content === 'string' ? "" : "<D:collection/>";
    }
    if (name === "getcontentlength") {
      return obj && obj.content && obj.content.length || 0;
    }
    if (obj && obj.hasOwnProperty(name)) {
      return obj[name];
    }
}

module.exports = {
  getProp: function (path, props) {
    var obj = find(path);
    if (obj) { console.log('LEN', path, typeof obj.content, obj.content && obj.content.length); }
    if (!obj) {
      return undefined;
    }
    return props.reduce((ps, name) => {
        ps[name] = getSingleProp(obj, name);
        return ps;
    }, {});
  },
  get: function (path) {
    return find(path);
  },
  put: function (path, entry) {
    var pos = path.lastIndexOf('/');
    var name = path.substr(pos + 1);
    path = path.substr(0, pos);
    var parent = find(path);
    if (parent) {
    // if (parent && !parent.hasOwnProperty(name)) {
      console.log('PUT_:', name, entry.content.length);
      parent[name] = entry;
      return parent[name];
    }
  },
  makeCol: function (path) {
    var pos = path.lastIndexOf('/');
    var name = path.substr(pos + 1);
    path = path.substr(0, pos);
    var parent = find(path);
    if (parent && !parent.hasOwnProperty(name)) {
      parent[name] = [];
      return parent[name];
    }
  },
  del: function (path) {
    console.log('DEL_:', path); // FIXME: TODO
    var pos = path.lastIndexOf('/');
    var name = path.substr(pos + 1);
    path = path.substr(0, pos);
    var parent = find(path);
    if (parent && parent[name]) {
      delete parent[name];
      return true;
    }
  },
  mv: function(path, dest) {
    console.log('MOVE_:', path, dest);
    entry = this.get(path);
    if (entry && this.put(dest, entry)) {
        return this.del(path);
    }
  },
  data: data
}

