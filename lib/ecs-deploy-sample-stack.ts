import { Stack, StackProps } from 'aws-cdk-lib';
import {
  aws_elasticloadbalancingv2 as elbv2,
  aws_ecs as ecs,
  aws_ec2 as ec2,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class EcsDeploySampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create a VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      subnetConfiguration: [
        {
          // PublicSubnet
          cidrMask: 24,
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          // NATを使う場合
          cidrMask: 24,
          name: 'application',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
        {
          // PrivateSubnet
          cidrMask: 24,
          name: 'rds',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ],
    });

    // create a security group
    // LoadBarancer用のセキュリティグループ
    const securityGroupELB = new ec2.SecurityGroup(this, 'SecurityGroupELB', {
      vpc,
      description: 'Security group ELB',
      securityGroupName: 'SGELB',
    })
    securityGroupELB.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from the world')

    // ECSで動作するアプリ用のセキュリティグループ
    const securityGroupAPP = new ec2.SecurityGroup(this, 'SecurityGroupAPP', {
      vpc,
      description: 'Security group APP',
      securityGroupName: 'SGAPP',
    })
    securityGroupAPP.addIngressRule(securityGroupELB, ec2.Port.tcp(80), 'Allow HTTP traffic from the ELB')

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      securityGroup: securityGroupELB,
      internetFacing: true,
      loadBalancerName: 'ALB',
    })

    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    })

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
    })

    listener.addTargetGroups('TargetGroup', {
      targetGroups: [targetGroup],
    })

    // ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.small'),
      spotInstanceDraining: true, // Spotインスタンスの利用設定
      spotPrice: '1.0',
      machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
      maxCapacity: 2,
      minCapacity: 1,
    })


    // ECS Task Definition
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDefinition', {
      networkMode: ecs.NetworkMode.AWS_VPC,
    })

    const container = taskDefinition.addContainer('Container', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 256,
      cpu: 256,
    })

    container.addPortMappings({
      hostPort: 80,
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    })

    // ECS Service
    const service = new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition,
      securityGroups: [securityGroupAPP],
    })
    service.attachToApplicationTargetGroup(targetGroup)
  }
}