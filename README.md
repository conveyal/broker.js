# broker.js: node-based task broker for Transport Analyst

The broker manages the compute cluster for Transport Analyst; it handles starting machines and parcelling tasks out to them.

## Development

First, run `npm install` to get all of the dependencies. You'll also need to install [Flow](http://flowtype.org/), which is a static type checker
for JavaScript. The broker is written in ES7, so it needs to be compiled to ES5 in order to use it. To compile, run

    npm run-script prepublish

Once the broker is compiled, you can start it with `npm start`. The port is configured in `config.yaml` and defaults to 9009.
