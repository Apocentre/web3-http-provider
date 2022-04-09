const errors = require('web3-core-helpers').errors;
const XHR2 = require('xhr2-cookies').XMLHttpRequest; 
const http = require('http');
const https = require('https');

class HttpProvider {
  constructor(hosts, options={}) {
    this.withCredentials = options.withCredentials || false;
    this.timeout = options.timeout || 0;
    this.headers = options.headers || [];
    this.agent = options.agent;
    this.connected = false;
    this.failedAttempts = 0

    var keepAlive = (options.keepAlive === true || options.keepAlive !== false) ? true : false;
    this.hosts = hosts || ['http://localhost:8545'];
    if (!this.agent) {
      this.httpsAgent = new https.Agent({ keepAlive: keepAlive });
      this.httpAgent = new http.Agent({ keepAlive: keepAlive });
    }
  }

  getHost() {
    return this.hosts[this.failedAttempts % this.hosts.length]
  }

  prepareRequest() {
    let request;

    // the current runtime is a browser
    if (typeof XMLHttpRequest !== 'undefined') {
      request = new XMLHttpRequest();
    } 
    else {
      request = new XHR2();
      const agents = {httpsAgent: this.httpsAgent, httpAgent: this.httpAgent, baseUrl: this.baseUrl};

      if (this.agent) {
        agents.httpsAgent = this.agent.https;
        agents.httpAgent = this.agent.http;
        agents.baseUrl = this.agent.baseUrl;
      }

      request.nodejsSet(agents);
    }

    request.open('POST', this.getHost(), true);
    request.setRequestHeader('Content-Type','application/json');
    request.timeout = this.timeout;
    request.withCredentials = this.withCredentials;

    if(this.headers) {
      this.headers.forEach(header => {
        request.setRequestHeader(header.name, header.value);
      });
    }

    return request;
  }

  async send(payload, callback) {
    if(this._hasTokenExpired()) {
      await this._refreshToken();
    }

    const request = this.prepareRequest();

    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.timeout !== 1) {
        let result = request.responseText;
        let error = null;

        try {
          result = JSON.parse(result);
        } catch(e) {
          this.failedAttempts += 1;
          error = errors.InvalidResponse(request.responseText);
        }

        this.connected = true;
        callback(error, result);
      }
    };

    request.ontimeout = () => {
      this.connected = false;
      this.failedAttempts += 1;
      callback(errors.ConnectionTimeout(this.timeout));
    };

    try {
      request.send(JSON.stringify(payload));
    } 
    catch(error) {
      this.connected = false;
      this.failedAttempts += 1;
      callback(errors.InvalidConnection(this.host));
    }
  }

  disconnect() {
    //NO OP
  }

  supportsSubscriptions() {
    return false;
  }
}

module.exports = HttpProvider;
