#!/usr/bin/env node
import 'source-map-support/register';
import { App, Tags } from 'aws-cdk-lib';
import { RevelacionesStack } from '../lib/revelaciones-stack';

const app = new App();
const envName: string = app.node.tryGetContext('env') ?? 'prod';

const stack = new RevelacionesStack(app, `deco-eventos-${envName}-revelaciones`, {
  envName,
  dominio: envName === 'prod' ? 'bananadecoparty.com' : undefined,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

Tags.of(stack).add('proyecto', 'deco-eventos');
Tags.of(stack).add('entorno', envName);
