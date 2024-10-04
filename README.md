# AI Mock Interview

![demo](./misc/democ.png)

## Description

This is a web application that allows users to practice mock interviews, in real-time, with an AI. The user selects a role and level, and optionally a job description. The AI is powered by OpenAI's realtime API and multi-modal model.

The server can be found [here](https://github.com/nip10/mock-interview-ai-server). It uses websockets to communicate with the client.

## Instructions

You can run the application standalone or with the server.

- Run `npm install` to install the dependencies.

### Standalone

- Duplicate `.env.example` and rename it to `.env`.
- Run `npm run dev` to start the development server.

Warning: DO NOT DEPLOY THE APPLICATION IN STANDALONE MODE. The API key is exposed in the client code.

### With Server

- Follow the instructions in the server repository to start the server.
- Change the value of `USE_LOCAL_RELAY_SERVER_URL` to the server URL.
- Run `npm run dev` to start the development server.

## Reference

- [Next.js](https://nextjs.org/docs/getting-started)
- [OpenAI Realtime Console](https://github.com/openai/openai-realtime-console)
