// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";
import { OPAEnvironmentParams, DynamoDBConstruct, } from '@aws/aws-app-development-common-constructs'
import { BasicProvisioningConstruct } from './constructs/basic-env-provisioning-role-construct'
import { BasicOperationsConstruct } from "./constructs/basic-env-operations-role-construct";

export interface OPABasicEnvStackProps extends cdk.StackProps {
  uniqueEnvIdentifier: string;
}

export class OPABasicEnvStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: OPABasicEnvStackProps) {
    super(scope, id, props);

    const prefix = process.env.PREFIX as string || "opa";
    const envName = process.env.ENV_NAME as string
    const awsAccount = process.env.AWS_ACCOUNT_ID as string
    const platformRoleArn = process.env.PLATFORM_ROLE_ARN as string
    const pipelineRoleArn = process.env.PIPELINE_ROLE_ARN as string
    const awsRegion = process.env.AWS_DEFAULT_REGION as string || "us-east-1"
    const cidrInput = process.env.ENV_CIDR as string || "10.0.0.0/24"

    // Creating environment params object

    const opaEnvParams: OPAEnvironmentParams = {
      envName: envName,
      awsRegion: awsRegion,
      awsAccount: awsAccount,
      prefix: prefix
    }

    const envIdentifier = opaEnvParams.envName;
    const envPathIdentifier = `/${envIdentifier}`

    // Create encryption key for all data at rest encryption
    const key = new kms.Key(this, `${envIdentifier}-key`, {
      alias: `${envIdentifier}-key`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(8),
    });

    // Save KMS key arn in an SSM Parameter
    new ssm.StringParameter(this, `${envIdentifier}-key-param`, {
      allowedPattern: ".*",
      description: `The KMS Key for Basic Solution: ${envIdentifier} Environment`,
      parameterName: `${envPathIdentifier}/kms-key`,
      stringValue: key.keyArn,
    });

    //create audit table
    const auditTableConstruct = new DynamoDBConstruct(this, "audit-table", {
      opaEnv: opaEnvParams,
      tableName: `${envIdentifier}-audit`,
      kmsKey: key,
    });

    // Create pipeline provisioning role for the environment
    const provisioningRoleConstruct = new BasicProvisioningConstruct(this, `${opaEnvParams.prefix}-${envIdentifier}-provisioning-role`, {
      opaEnv: opaEnvParams,
      KMSkey: key,
      assumedBy: pipelineRoleArn,
      auditTable: auditTableConstruct.table.tableName
    });

    // Create operations role for the environment
    const operationsRoleConstruct = new BasicOperationsConstruct(this, `${opaEnvParams.prefix}-${envIdentifier}-operations-role`, {
      opaEnv: opaEnvParams,
      KMSkey: key,
      assumedBy: platformRoleArn,
      auditTable: auditTableConstruct.table.tableName
    });

    // save the unique environment identifier
    const uniqueEnvId = new ssm.StringParameter(this, `${envIdentifier}-unique-id-param`, {
      allowedPattern: ".*",
      description: `The Unique ID for: ${opaEnvParams.envName} Environment`,
      parameterName: `${envPathIdentifier}/unique-id`,
      stringValue: props.uniqueEnvIdentifier,
    });

    // Printing outputs
    new cdk.CfnOutput(this, "Environment_Name", {
      value: envName,
    });

    // Printing the unique environment ID
    new cdk.CfnOutput(this, "Environment_ID", {
      value: uniqueEnvId.stringValue,
    });

    // Printing audit table
    new cdk.CfnOutput(this, "AuditTable", {
      value: auditTableConstruct.tableParam.parameterName,
    });

    // Print role information
    new cdk.CfnOutput(this, "Provisioning_Role", {
      value: provisioningRoleConstruct.provisioningRoleParam.parameterName,
    });

    new cdk.CfnOutput(this, "Provisioning_Role_ARN", {
      value: provisioningRoleConstruct.provisioningRoleArnParam.parameterName,
    });

    new cdk.CfnOutput(this, "Operations_Role", {
      value: operationsRoleConstruct.operationsRoleParam.parameterName,
    });

    new cdk.CfnOutput(this, "Operations_Role_ARN", {
      value: operationsRoleConstruct.operationsRoleArnParam.parameterName,
    });

    // print the stack name as a Cloudformation output
    new cdk.CfnOutput(this, `StackName`, {
      value: this.stackName,
      description: "The Basic Environment Provider CF Stack name",
    });
  }
}
