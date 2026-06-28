## Install and Run

```
$ npm install
```

## Environment variables

By Default k6 supports environment variables using "-e VARIABLE=value" command line arguments

For more information see https://grafana.com/docs/k6/latest/using-k6/environment-variables/

## Using the template

Create a copy of `.env.template` and call it `.env`

## This project uses dotenv-cli

One could use globally though I prefer to keep things localised

I added dotenv using
```
$ npm install --save-dev dotenv-cli
```

Now when you run the script there are options,

If `dotenv` is install globally

```
$ dotenv -e .env -- k6 run script.js
```

Or you can use scripts in package file

```
$ npm run test:e2e_1
```

Or you can use `npx` (note you can remove the `--` which just signifies end of command options)

```
$ npx dotenv -e .env -- k6 run e2e.js
```

## ENV Variables in REST Client file (.rest)

`.env` variables are referenced through `{{$dotenv ENV_VARIABLE}}`