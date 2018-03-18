var data = { 'test': { 'a.txt': { mime: 'text/plain', content: 'a.contents' } } };

function find(path) {
  return path.replace(/[^\._A-Za-z\/]/g, '').split('/').reduce(function (data, name) {
    if (name === "") return data;
    // console.log('fnd:', data, name);
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
        if (obj && obj.content) {
          console.log('obj.len', path, typeof obj.content, obj.content.length);
        }
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
  put: function (path, contents) {
    var pos = path.lastIndexOf('/');
    var name = path.substr(pos + 1);
    path = path.substr(0, pos);
    var parent = find(path);
    if (parent) {
    // if (parent && !parent.hasOwnProperty(name)) {
      parent[name] = contents;
      return parent[name];
    }
  },
  makeCol: function (path) {
    path = path.substr(0, path.length - 1);
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
    path = path.substr(0, path.length - 1);
    var pos = path.lastIndexOf('/');
    var name = path.substr(pos + 1);
    path = path.substr(0, pos);
    var parent = find(path);
    if (parent && parent.hasOwnProperty(name)) {
      delete parent[name];
      return true;
    }
  },
  data: data
}

