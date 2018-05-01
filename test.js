var Xml = require('./lib/simplexml');
var source = require('./provider');
var PORT = 6543;
var HOST = "127.0.0.1";

var http = require('http');

// "OPTIONS, GET, HEAD, POST, TRACE, PROPFIND, PROPPATCH, MKCOL, COPY, PUT, DELETE, MOVE, LOCK, UNLOCK, BIND, REBIND, UNBIND, VERSION-CONTROL"
var Handlers = {
  OPTIONS: function (req, res, body) {
    res.writeHeader(200, {
      Dav: "1,2",
      Allow: Object.keys(Handlers).join(', '),
    });
    res.end();
  },
  PROPFIND: function (req, res, body) {
    var xml = Xml.parse(body);
    const depth = parseInt(req.headers['depth']);
    //console.log('>PROPFIND', body, JSON.stringify(req.headers, null, 2));
    xml.depth = depth;
    xml.url = req.url;
    // console.log('>PROPFIND', JSON.stringify(xml, null, 2));

    function propfind(url, props) {
        var value = source.getProp(url, props);

        var group = "HTTP/1.1 200 OK";
        if (value === undefined) {
          var group = "HTTP/1.1 404 Not Found";
        }

        var results = {};
        if (!results[group]) {
          results[group] = {};
        }
        results[group] = value;

        // console.log('>propfind', url, results);
        return {
            response: {
              href: url,
              propstat: Object.keys(results).map(function (group) {
                return { prop: results[group], status: group };
              })
            }
        };
    }
    var propnames = Object.keys(xml.propfind.prop);
    var v = propfind(req.url, propnames);
    if (v.response.propstat && v.response.propstat[0] && v.response.propstat[0].status === 'HTTP/1.1 404 Not Found') {
      res.writeHeader(404, "Not Found", {});
      res.end();
      return;
    }
    if (depth > 0) {
        res.writeHeader(207, "Multi Status", {
          "Content-Type": 'text/xml; charset="utf-8"'
        });
        res.write(Xml.renderKeyStartTag('multistatus', true));
        res.write(Xml.render(v, false));

        const o = source.get(req.url);
        Object.keys(o).map(function(item) {
            let e = propfind(req.url+''+item, propnames);
            const xml = Xml.render(e, false)
            console.log(xml);
            res.write(xml);
        });
        res.write(Xml.renderKeyEndTag('multistatus'));
    } else {
       var output = Xml.renderDoc({ multistatus: v });
       // console.log('<getProp', JSON.stringify(v, null, 2));
       res.writeHeader(207, "Multi Status", {
         "Content-Type": 'text/xml; charset="utf-8"',
         "Content-length": output.length
       });
       res.write(output);
    }
    res.end();
  },
  MKCOL: function (req, res, body) {
    if (source.makeCol(req.url)) {
      res.writeHeader(201, "Created", {});
      res.end();
    } else {
      res.writeHeader(409, "Conflict", {});
      res.end();
    }
  },
  DELETE: function (req, res, body) {
    // TODO: Implement
    if (source.del(req.url)) {
      res.writeHeader(204, "No Content", {});
      res.end();
    } else {
      res.writeHeader(404, "Not Found", {});
      res.end();
    }
  },
  MOVE: function(req, res, body) {
    // MOVE /lara-fabian.jpg HTTP/1.1
    // headers: { host: '127.0.0.1:6543',
    //   destination: 'http://127.0.0.1:6543/test/lara-fabian.jpg',
    //   'user-agent': 'WebDAVFS/3.0.0 (03008000) Darwin/15.6.0 (x86_64)' }
    if (source.mv(req.url, require('url').parse(req.headers['destination']).path)) {
      res.writeHeader(204, "No Content", {});
      res.end();
    } else {
      res.writeHeader(404, "Not Found", {});
      res.end();
    }
  },
  LOCK: function (req, res, body) {
    // TODO: implement locking
    var output = Xml.renderDoc({ lock: { lockdiscovery: { activelock: {
        locktype: { transaction: { groupoperation: {} } },
        lockscope: { local: {} },
        depth: 0,
        owner: { href: req.url },
        timeout: 'Second-3600',
        locktoken: { href: 'LOCKTOKEN-'+req.url }
    }}}});
    res.writeHeader(200, "Multi Status", {
      "Content-Type": 'text/xml; charset="utf-8"',
      "Content-length": output.length
    });
    res.write(output);
    res.end();
  },
  UNLOCK: function (req, res, body) {
    // TODO: implement locking
    console.log("UNLOCK:", req.headers['lock-token']);
    res.writeHeader(204, "No Content", {});
    res.end();
  },
  PUT: function (req, res, body) {
    if (source.put(req.url, { mime: req.headers['content-type'], content: body})) {
      res.writeHeader(201, "Created", {});
      res.end();
    } else {
      res.writeHeader(409, "Conflict", {});
      res.end();
    }
  },
  GET: function (req, res, body) {
    var data;
    if (data = source.get(req.url)) {
      res.writeHeader(200, {
        "Content-Type": data.mime,
        "Content-Length": data.content.length
      });
      res.write(new Buffer(data.content, "binary"));
      res.end();
    } else {
      res.writeHeader(404, {});
      res.end();
    }
  },
  POST: function () {},
};

http.createServer(function (req, res) {
  console.log(req.method + " " + req.url + " HTTP/" + req.httpVersionMajor + "." + req.httpVersionMinor);
  const p = console.log;
  // p(source.data);

  var end = res.end;
  res.end = function () {
    // Common Log Format (mostly)
    p(/*req.connection.remoteAddress + " - - [" + (new Date()).toUTCString() + "] \"" + */ req.method + " " + req.url + " HTTP/" + req.httpVersionMajor + "." + req.httpVersionMinor + "\" " + res.statusCode + " " + (res.output[0] && res.output[0].length) + " \"" + (req.headers['referrer'] || "") + "\""); // \"" + req.headers["user-agent"] + "\"");
    return end.apply(res, arguments);
  }

  var writeHeader = res.writeHeader;
  res.writeHeader = function (code) {
    res.statusCode = code;
    return writeHeader.apply(res, arguments);
  }

  function get_body(callback) {
    var content = '';
    req.addListener('data', function (chunk) {
      content += chunk.toString('binary');
    });
    req.addListener('end', function () {
      callback(content);
    });
  }

  if (Handlers[req.method]) {
    get_body(function (body) {
      Handlers[req.method](req, res, body);
    });
  } else {
    get_body(function (body) {
      p(req.headers);
      p(body);
      res.writeHeader(500, {'Content-Type': 'text/plain'});
      res.write(body);
      res.end();
    });
  }
}).listen(6543);

var address = "http://" + HOST + ":" + PORT;
console.log("SERVER STARTED ON " + address);

process.addListener("uncaughtException", function (err) {
  console.error(err.stack);
});
