# Dubbo 泛化调用客户端

[![GitHub stars](https://img.shields.io/github/stars/itning/generic-service-client-web.svg?style=social&label=Stars)](https://github.com/itning/generic-service-client-web/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/itning/generic-service-client-web.svg?style=social&label=Fork)](https://github.com/itning/generic-service-client-web/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/itning/generic-service-client-web.svg?style=social&label=Watch)](https://github.com/itning/generic-service-client-web/watchers)
[![GitHub followers](https://img.shields.io/github/followers/itning.svg?style=social&label=Follow)](https://github.com/itning?tab=followers)

[![GitHub issues](https://img.shields.io/github/issues/itning/generic-service-client-web.svg)](https://github.com/itning/generic-service-client-web/issues)
[![GitHub license](https://img.shields.io/github/license/itning/generic-service-client-web.svg)](https://github.com/itning/generic-service-client-web/blob/master/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/itning/generic-service-client-web.svg)](https://github.com/itning/generic-service-client-web/commits)
[![GitHub release](https://img.shields.io/github/release/itning/generic-service-client-web.svg)](https://github.com/itning/generic-service-client-web/releases)
[![GitHub repo size in bytes](https://img.shields.io/github/repo-size/itning/generic-service-client-web.svg)](https://github.com/itning/generic-service-client-web)
[![HitCount](http://hits.dwyl.io/itning/generic-service-client-web.svg)](http://hits.dwyl.io/itning/generic-service-client-web)
[![language](https://img.shields.io/badge/language-Angular-green.svg)](https://github.com/itning/generic-service-client-web)

## 项目架构

前端：Angular ；项目地址：[itning/generic-service-client-web](https://github.com/itning/generic-service-client-web)

后端：Spring Boot ；项目地址：[itning/generic-service-client](https://github.com/itning/generic-service-client)

## 介绍

测试盒子：

主要功能是dubbo泛化直连调用，直接使用网页调用Dubbo接口！

## 快速开始

### 部署

#### 后端

目前接口**提示功能仅支持Zookeeper注册中心**，如果注册中心不是用的Zookeeper就不需要配这个地址

[application.properties](https://github.com/itning/generic-service-client/blob/master/test-deploy/src/main/resources/application.properties#L6) 文件配置ZK地址用于提示，如果不需要提示则不需要配置！

```properties
# 支持多个ZK注册中心，例如下面就写了三个注册中心（A,B,C）
test-zk.zk-list.A=192.168.66.1:2181,192.168.66.2:2181:2181,192.168.66.3:2181
test-zk.zk-list.B=192.168.77.1:2181,192.168.77.2:2181:2181,192.168.77.3:2181
test-zk.zk-list.C=192.168.88.1:2181,192.168.88.2:2181:2181,192.168.88.3:2181
```

其它配置不需要改动，默认端口号：8868

配置后弱类型接口名输入框会有个下拉框，如图：

![xialakuang](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/xialakuang.jpg)

如果没有配置，则是这样的：

![meiyouxialakuang](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/meiyouxialakuang.jpg)

配置后点击输入框会有提示：

![zidong](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/zidong.jpg)

#### 前端

前端需要知道后端的地址，所以需要改动前端配置：

默认开发环境：[environment.ts](https://github.com/itning/generic-service-client-web/blob/master/src/environments/environment.ts#L8)

默认本地生产环境：[environment.local.ts](https://github.com/itning/generic-service-client-web/blob/master/src/environments/environment.local.ts#L4)

默认线上生产环境：[environment.prod.ts](https://github.com/itning/generic-service-client-web/blob/master/src/environments/environment.prod.ts#L4)

开发环境运行：`npm run start`

构建生产和本地：`npm run buildAll`

### 使用说明

#### 当有多个服务提供者的时候，会提示选择：

![zidong](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/zidong.jpg)

#### 点击编辑参数，可以对参数进行修改：

![bianjicanshu](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/bianjicanshu.jpg)

参数数据结构：

```json
[
  {
    "top.itning.Request": {
      "age": 1
    }
  },
  {
    "top.itning.Request2": {
      "dto": {
        "a": "a",
        "b": [1,2, 3 ]
      }
    }
  }
]
```

最外层是数组数组中每个对象只有一个KEY，KEY名代表接口参数的类全路径名，值代表参数值，而后每一个KEY代表属性名，VALUE为属性值。

点击确定后，解析结果如图：

![jiexijieguo](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/jiexijieguo.jpg)

#### 支持dubbo URL解析：

![dubboURLjiexi](https://raw.githubusercontent.com/itning/generic-service-client/master/pic/dubboURLjiexi.jpg)

