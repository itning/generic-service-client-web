import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {NzModalService} from 'ng-zorro-antd/modal';
import {v4 as uuidv4} from 'uuid';
import {FormParamsInfo, PersistenceService} from '../../../../service/persistence.service';
import {
  Artifact,
  AttributeValueType,
  EnvInfo,
  GenericService,
  Item,
  MavenRequest,
  MethodInfo,
  TabInfo,
  Type,
  WebSocketMessageType,
  WebSocketResultModel
} from '../../../../service/generic.service';
import JSONEditor from 'jsoneditor';
import {NzMessageService} from 'ng-zorro-antd/message';
import {UtilsService} from '../../../../service/utils.service';
import {NzAutocompleteOptionComponent} from 'ng-zorro-antd/auto-complete';
import {NzUploadFile, NzUploadXHRArgs} from 'ng-zorro-antd/upload/interface';
import {EMPTY, Observable, Subscription} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {AutocompleteDataSource} from 'ng-zorro-antd/auto-complete/autocomplete.component';
import {AbstractControl} from '@angular/forms';

@Component({
  selector: 'app-attribute',
  templateUrl: './attribute.component.html',
  styleUrls: ['./attribute.component.scss']
})
export class AttributeComponent implements OnInit {

  /**
   * 每个TAB页的实例
   */
  @Input()
  tabs: TabInfo[] = [];

  /**
   * 当前选择的TAB页
   */
  @Input()
  selectedIndex = 0;

  /**
   * 发送请求
   */
  @Output()
  request: EventEmitter<TabInfo> = new EventEmitter<TabInfo>();

  /**
   * TAB选择改变事件
   */
  @Output()
  tabSelectChange: EventEmitter<number> = new EventEmitter<number>();

  // noinspection JSUnusedGlobalSymbols
  private options = {
    mode: 'code',
    modes: ['code', 'form', 'text', 'tree', 'view', 'preview'], // allowed modes
    onError: (err) => {
      alert(err.toString());
    },
    onModeChange: (newMode, oldMode) => {
      console.log('Mode switched from', oldMode, 'to', newMode);
    }
  };

  /**
   * JSONEditor实例
   */
  editor: any;

  @ViewChild('jsonEditor') set content(content: ElementRef) {
    if (content && this.needEditParamArray) {
      const editor = new JSONEditor(content.nativeElement, this.options);
      const conversionRequest2 = this.genericService.conversionRequest(this.needEditParamArray);
      editor.set(conversionRequest2);
      this.editor = editor;
    }
  }

  /**
   * 需要修改的参数
   */
  needEditParamArray: Item[];

  /**
   * 模态框显示
   */
  modalShow = {
    editInterfaceParam: false,
    resolveUrl: false,
    resolveUrlSelect: false,
    methodOverloading: false,
    tabReName: false,
    maven: false,
    download: false,
    mavenVersion: false
  };

  /**
   * 自动完成
   */
  autocomplete = {
    interfaces: {
      availableFilter: []
    },
    methods: {
      availableFilter: []
    }
  };

  /**
   * 用户填的解析URL值
   */
  resolveURLValue: string;

  /**
   * 所有可用的环境
   */
  availableEnv: EnvInfo[] = [];

  /**
   * 多个提供者信息
   */
  providerInfoArray: ProviderInfo[] = [];

  /**
   * 文件上传列表
   */
  uploadFileList: NzUploadFile[];

  /**
   * 方法重载信息数组
   */
  methodInfoArray: MethodInfo[];

  /**
   * 选择的方法重载信息
   */
  resolveMethodInfo: MethodInfo;

  /**
   * 原来的TAB页信息，用于修改TAB名展示
   */
  oldTab: TabInfo;

  /**
   * TAB的新名称
   */
  tabNameForReName: string;

  /**
   * 填写的maven XML信息
   */
  mavenXml: string = '<dependency>\n' +
    '  <groupId></groupId>\n' +
    '  <artifactId></artifactId>\n' +
    '  <version></version>\n' +
    '</dependency>';

  /**
   * 填写的maven信息
   */
  mavenXmlInputValue: Artifact = {
    groupId: '',
    artifactId: '',
    version: ''
  };

  /**
   * maven坐标填写后的加载条显示
   */
  mavenLoading: boolean;

  /**
   * 下载进度信息
   */
  downloadProgress: number;

  /**
   * 下载速度信息
   */
  downloadSpeed: number;

  /**
   * 取消下载时的TOKEN信息
   */
  cancelToken: string;

  /**
   * 可选的maven版本信息
   */
  mavenArtifacts: Artifact[];

  /**
   * 选择的maven版本信息
   */
  resolveMavenArtifact: Artifact;

  /**
   * 填写maven信息时选择的TAB页
   */
  mavenXmlTabIndex = 0;

  constructor(private modal: NzModalService,
              private persistenceService: PersistenceService,
              private genericService: GenericService,
              private message: NzMessageService,
              private util: UtilsService) {
  }

  ngOnInit(): void {
    this.genericService.getAvailableEnv().subscribe((availableEnv) => {
      if (availableEnv && availableEnv.length > 0) {
        this.availableEnv = availableEnv.map(item => new EnvInfo(item));
        const selectEnv = this.tabs[this.selectedIndex].selectEnv;
        if (selectEnv && availableEnv.includes(selectEnv.env)) {
          this.initAvailableInterFace(selectEnv.tag, selectEnv.env);
        } else {
          if (selectEnv && selectEnv.env !== '') {
            this.message.warning('Zookeeper环境信息已变化！');
            this.tabs[this.selectedIndex].selectEnv = new EnvInfo('||');
          }
        }
      } else {
        console.log('注册中心当前未连接请稍后再试！');
      }
    });
    this.genericService.connectionResultWebSocketReply().subscribe(model => {
      const tabInfo = this.tabs.find(it => it.id === model.echo);
      if (tabInfo) {
        if (model.type === WebSocketMessageType.PLAINTEXT || model.type === WebSocketMessageType.JSON) {
          tabInfo.isRequestLoading = false;
        }
        this.parseDownloadMessage(model);
      }
    });
  }

  /**
   * 发起maven请求
   * @param mavenRequest maven请求
   * @private
   */
  private sendMavenRequest(mavenRequest: MavenRequest): void {
    this.genericService.sendMavenRequest(mavenRequest)
      .subscribe(response => {
        this.mavenLoading = false;
        this.modalShow.maven = false;
        if (!response.success) {
          this.message.error(response.message);
        }
      }, () => {
        this.mavenLoading = false;
        this.modalShow.maven = false;
      });
  }

  /**
   * 解析下载事件
   * @param model 事件模型
   * @private
   */
  private parseDownloadMessage(model: WebSocketResultModel): void {
    switch (model.type) {
      case WebSocketMessageType.NEXUS_DOWNLOAD_CANCEL_TOKEN:
        this.cancelToken = model.message;
        this.downloadSpeed = 0;
        this.downloadProgress = 0;
        this.modalShow.download = true;
        break;
      case WebSocketMessageType.NEXUS_DOWNLOAD_PROGRESS:
        const progressArray = model.message.split('-');
        const downloadBytes = Number(progressArray[0]);
        const totalBytes = Number(progressArray[1]);
        this.downloadProgress = Math.round(downloadBytes / totalBytes * 100);
        this.downloadSpeed = Number(progressArray[2]);
        break;
      case WebSocketMessageType.NEXUS_DOWNLOAD_FAILED:
        this.message.error(model.message);
        this.modalShow.download = false;
        break;
      case WebSocketMessageType.NEXUS_DOWNLOAD_SUCCESS:
        const info: MethodInfo[] = JSON.parse(model.message);
        if (info && info.length > 0) {
          if (info.length === 1) {
            this.parsingParameters(info[0]);
          } else {
            // 有重载
            this.methodInfoArray = info;
            this.modalShow.methodOverloading = true;
          }
        } else {
          this.message.warning('在上传的文件中没有找到该方法！');
        }
        this.modalShow.download = false;
        this.message.success('解析完成');
        break;
    }
  }

  /**
   * 验证接口名和方法信息是否填写
   * @param tabInfo TAB页
   * @private
   */
  private validInterfaceNameAndMethod(tabInfo: TabInfo): { interfaceName: AbstractControl, method: AbstractControl } | null {
    const formParams = tabInfo.formParams;
    const interfaceName = formParams.get('interfaceName');
    const method = formParams.get('method');
    interfaceName.markAsDirty();
    interfaceName.updateValueAndValidity();
    method.markAsDirty();
    method.updateValueAndValidity();
    if (!interfaceName.valid || !method.valid) {
      this.message.warning('请先填写接口名和方法名！');
      return null;
    }
    return {interfaceName, method};
  }

  /**
   * 递归删除某一个参数
   * @param items 接口参数信息
   * @param id 要删除的参数ID
   * @private
   */
  private delArrayItemById(items: Item[], id: string): void {

    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items.splice(i, 1);
        return;
      }
      if (items[i].attributeValue instanceof Array) {
        this.delArrayItemById(items[i].attributeValue as Item[], id);
      }
    }
  }

  /**
   * 解析参数
   * @param methodInfo 方法信息
   * @private
   */
  private parsingParameters(methodInfo: MethodInfo): void {
    const result = [];
    for (let i = 0; i < methodInfo.paramClassName.length; i++) {
      const re = {};
      const prop = methodInfo.property[i];
      re[methodInfo.paramClassName[i]] = prop[Object.keys(prop)[0]];
      result.push(re);
    }
    this.tabs[this.selectedIndex].parameterValue = this.parseTheModifiedParameters(result, true);
  }

  /**
   * 获取友好的进度信息
   */
  getGoodProgress(): string {
    let downloadSpeed = this.downloadSpeed;
    if (!downloadSpeed || Number.isNaN(downloadSpeed)) {
      downloadSpeed = 0;
    }
    if (downloadSpeed <= 1024) {
      return `${downloadSpeed.toFixed(2)}KB/s`;
    } else if (downloadSpeed <= 1048576) {
      return `${(downloadSpeed / 1024).toFixed(2)}MB/s`;
    } else {
      return `${(downloadSpeed / 1024 / 1024).toFixed(2)}GB/s`;
    }
  }

  /**
   * 关闭TAB页
   * @param index 索引
   */
  closeTab({index}: { index: number }): void {
    this.modal.confirm({
      nzTitle: '确定关闭吗？',
      nzOnOk: () => {
        this.tabs.splice(index, 1);
        this.persistenceService.saveGenericParamInfo(this.tabs);
        this.persistenceService.saveMetaInfo('nowSelectedTabIndex', this.selectedIndex);
      }
    });
  }

  /**
   * 新打开TAB页
   */
  newTab(): void {
    this.tabs.push(new TabInfo(
      uuidv4(), 'Unnamed Tab',
      this.genericService.generateFormParams(), [], []));
    this.selectedIndex = this.tabs.length;
    this.persistenceService.saveGenericParamInfo(this.tabs);
  }

  /**
   * 添加接口参数
   * @param parameterValue 当前页的接口参数信息
   */
  addInterfaceParam(parameterValue: Item[]): void {
    parameterValue.push(Item.generateString('', ''));
  }

  /**
   * 处理参数删除事件
   * @param id 要删除的参数ID
   * @param parameterValue 当前页的接口参数信息
   */
  handleDeleteEvent(id: string, parameterValue: Item[]): void {
    this.delArrayItemById(parameterValue, id);
  }

  /**
   * 处理新增参数事件
   * @param data 某一项参数信息
   */
  handleAddEvent(data: AttributeValueType): void {
    (data as Item[]).push(Item.generateString('', ''));
  }

  /**
   * 发送请求；持久化参数信息
   * @param tab 哪个TAB页调用的
   */
  sendRequest(tab: TabInfo): void {
    for (const i in tab.formParams.controls) {
      if (tab.formParams.controls.hasOwnProperty(i)) {
        tab.formParams.controls[i].markAsDirty();
        tab.formParams.controls[i].updateValueAndValidity();
      }
    }
    if (tab.formParams.valid) {
      this.request.emit(tab);
    }
  }

  /**
   * 处理TAB切换
   */
  handleTabChange(): void {
    const tabInfo = this.tabs[this.selectedIndex];
    this.autocomplete.methods.availableFilter = tabInfo.availableMethod;
    this.autocomplete.interfaces.availableFilter = tabInfo.availableInterface;
    this.tabSelectChange.emit(this.selectedIndex);
  }

  /**
   * 修改参数
   * @param parameterValue 参数
   */
  editInterfaceParam(parameterValue: Item[]): void {
    this.needEditParamArray = parameterValue;
    this.modalShow.editInterfaceParam = true;
  }

  /**
   * 修改参数确认
   */
  doEditInterfaceParam(): void {
    if (this.editor) {
      try {
        const editorItems = this.editor.get();
        if (!this.checkEditDataOrderly(editorItems)) {
          return;
        }
        this.tabs[this.selectedIndex].parameterValue = this.parseTheModifiedParameters(editorItems);
      } catch (e) {
        console.warn(e);
        this.message.error('解析失败！');
      }
      this.needEditParamArray = null;
      this.modalShow.editInterfaceParam = false;
    }
  }

  /**
   * 检查修改的数据是否正确
   * @param data 数据
   * @private
   */
  private checkEditDataOrderly(data: any): boolean {
    if (Type.ARRAY !== this.util.getObjectType(data)) {
      this.message.error('最外层必须是个数组！');
      return false;
    }
    for (const item of data) {
      if (Type.OBJECT !== this.util.getObjectType(item)) {
        this.message.error('最外层数组中每一项必须是对象！');
        return false;
      }
      if (Object.keys(item).length > 1) {
        this.message.error('最外层数组中每一项的对象只能有一个KEY！');
        return false;
      }
    }
    return true;
  }

  /**
   * 解析修改的参数
   * @param editorItems 修改后的参数
   * @param isUpload 上传调用
   * @private
   */
  private parseTheModifiedParameters(editorItems: any, isUpload = false): Item[] {
    const result: Item[] = [];
    for (const item of editorItems) {
      const key = Object.keys(item)[0];
      const value = item[key];
      result.push(this.generateItem(key, value, isUpload));
    }
    return result;
  }

  /**
   * 根据值类型生成Item
   * @param name Item名字
   * @param value Item值
   * @param needTransform 需要将文本转换到对应的类型
   * @private
   */
  private generateItem(name: string, value: any, needTransform = false): Item {
    let valueType = this.util.getObjectType(value);
    if (valueType === Type.ARRAY) {
      return Item.generateArray(name, this.generateItemForArray(value, needTransform));
    } else if (valueType === Type.OBJECT) {
      return Item.generateObject(name, this.generateItemForObject(value, needTransform));
    } else {
      const autoComplete: AutocompleteDataSource = [];
      let originalValue = '';
      if (needTransform) {
        originalValue = `参数类型：${value}`;
        if (value.startsWith('enum|')) {
          const start = value.indexOf('|');
          const temp = value.substring(start + 1);
          const classNameSplit = temp.indexOf('|');
          const className = temp.substring(0, classNameSplit);
          const json = temp.substring(classNameSplit + 1);
          const enums = JSON.parse(json);
          autoComplete.push(...enums);
          originalValue = `参数类型：${className}`;
        }
        switch (value) {
          case 'java.lang.Integer':
          case 'java.lang.Long':
          case 'java.lang.Short':
          case 'byte':
          case 'short':
          case 'int':
          case 'long' :
            valueType = Type.NUMBER;
            value = '';
            break;
          case 'java.lang.Double':
          case 'java.lang.Float':
          case 'float':
          case 'double':
            valueType = Type.NUMBER;
            value = '';
            break;
          case 'java.lang.Character':
          case 'java.lang.String':
            valueType = Type.STRING;
            value = '';
            break;
          case 'java.lang.Boolean':
          case 'boolean':
            valueType = Type.BOOLEAN;
            value = '';
            autoComplete.push('true', 'false');
            break;
          case 'java.util.Date':
          case 'java.sql.Date':
          case 'java.sql.Timestamp':
          case 'java.sql.Time':
            valueType = Type.DATE;
            value = this.util.getNowDate2String();
            originalValue = '日期格式：yyyy-MM-dd HH:mm:ss';
            break;
          case 'java.time.LocalDate':
          case 'java.time.LocalTime':
          case 'java.time.LocalDateTime':
            valueType = Type.DATE_8601;
            value = this.util.getNowDate2_8301String();
            originalValue = '日期格式：yyyy-MM-ddTHH:mm:ss';
            break;
          default:
            valueType = Type.STRING;
            value = '';
        }
      }
      switch (valueType) {
        case Type.NUMBER:
          return Item.generateNumber(name, value, originalValue, autoComplete);
        case Type.BOOLEAN:
          return Item.generateBoolean(name, value, originalValue, autoComplete);
        case Type.DATE:
          return Item.generateDate(name, value, originalValue, autoComplete, new Date());
        case Type.DATE_8601:
          return Item.generateDATE_8601(name, value, originalValue, autoComplete, new Date());
        default:
          if (this.util.isMatchDateString(value)) {
            const attributeValueDate = this.util.formatDateString2Date(value);
            return Item.generateDate(name, value, '日期格式：yyyy-MM-dd HH:mm:ss', autoComplete, attributeValueDate);
          } else if (this.util.isMatchDate_8301String(value)) {
            const attributeValueDate = this.util.formatDate_8301String2Date(value);
            return Item.generateDATE_8601(name, value, '日期格式：yyyy-MM-ddTHH:mm:ss', autoComplete, attributeValueDate);
          } else {
            return Item.generateString(name, value, originalValue, autoComplete);
          }
      }
    }
  }

  /**
   * 处理自动填充参数
   * @param interfaceName 接口名
   * @private
   */
  private handleAutoFillingParam(interfaceName: string): void {
    const tabInfo = this.tabs[this.selectedIndex];
    this.genericService.getURL(tabInfo.selectEnv.env, tabInfo.selectEnv.tag, interfaceName).subscribe(url => {
      if (url && url.success && url.data && url.data.length > 0) {
        if (url.data.length === 1) {
          this.resolveURLValue = decodeURIComponent(url.data[0]);
          this.resolveURL();
        } else {
          this.providerInfoArray = url.data.map(item => {
            item = decodeURIComponent(item);
            const host = item.substring(8, item.indexOf('/', 8));
            const group = this.util.getParamValue(item, 'group');
            const version = this.util.getParamValue(item, 'version');
            return new ProviderInfo(item, `主机：${host} 分组：${group} 版本：${version}`);
          });
          this.message.info('有多个提供者，请选择一个！');
          this.resolveURLValue = '';
          this.modalShow.resolveUrlSelect = true;
        }
      } else {
        tabInfo.availableMethod = this.autocomplete.methods.availableFilter = [];
        if (url && !url.regConnected) {
          this.message.warning('注册中心当前未连接请稍后再试！');
        } else {
          this.message.warning('服务没有提供者！');
        }
      }
    });
  }

  /**
   * 生成对象类型
   * @param items 每一项
   * @param needTransform 需要将文本转换到对应的类型
   */
  generateItemForObject(items: any, needTransform = false): Item[] {
    const result: Item[] = [];
    for (const key in items) {
      if (items.hasOwnProperty(key)) {
        result.push(this.generateItem(key, items[key], needTransform));
      }
    }
    return result;
  }

  /**
   * 生成数组类型
   * @param items 每一项
   * @param needTransform 需要将文本转换到对应的类型
   */
  generateItemForArray(items: any, needTransform = false): Item[] {
    const result: Item[] = [];
    for (const item of items) {
      result.push(this.generateItem('', item, needTransform));
    }
    return result;
  }

  /**
   * 清空
   */
  clearAll(): void {
    const tabInfo = this.tabs[this.selectedIndex];
    if (tabInfo) {
      tabInfo.parameterValue = [];
      tabInfo.formParams.reset({url: '', interfaceName: '', method: '', version: '', group: ''});
    }
  }

  /**
   * 解析URL
   */
  resolveURL(): void {
    if (!this.resolveURLValue) {
      this.message.warning('URL不能为空！');
      return;
    }
    if (!this.resolveURLValue.startsWith('dubbo://')) {
      this.message.warning('URL必须以dubbo://开头！');
      return;
    }
    const host = this.resolveURLValue.substring(8, this.resolveURLValue.indexOf('/', 8));
    const interfaceName = this.util.getParamValue(this.resolveURLValue, 'interface');
    const group = this.util.getParamValue(this.resolveURLValue, 'group');
    const version = this.util.getParamValue(this.resolveURLValue, 'version');
    const methods = this.util.getParamValue(this.resolveURLValue, 'methods');
    const path = this.util.getParamValue(this.resolveURLValue, 'path');
    const tabInfo = this.tabs[this.selectedIndex];
    tabInfo.formParams.setValue({url: host, interfaceName, group, version, method: '', path});
    this.autocomplete.methods.availableFilter = tabInfo.availableMethod = methods.split(',');
    this.message.success('解析完成！');
    this.modalShow.resolveUrl = false;
  }

  /**
   * 可用方法过滤
   * @param $event Event
   */
  availableMethodsAutoCompleteFilter($event: Event): void {
    $event.preventDefault();
    const value = ($event.target as HTMLInputElement).value;
    this.autocomplete.methods.availableFilter = this.tabs[this.selectedIndex].availableMethod.filter(item => item.indexOf(value) !== -1);
  }


  /**
   * 可用方法过滤
   * @param $event Event
   */
  availableInterFacesAutoCompleteFilter($event: Event): void {
    $event.preventDefault();
    const value = ($event.target as HTMLInputElement).value;
    this.autocomplete.interfaces.availableFilter =
      this.tabs[this.selectedIndex].availableInterface.filter(item => item.indexOf(value) !== -1);
  }

  /**
   * 初始化可用接口信息
   * @param tag 标签
   * @param env 环境
   */
  initAvailableInterFace(tag: string, env: string): void {
    this.genericService.getAvailableInterFaces(tag, env).subscribe((availableInterface) => {
      if (availableInterface && availableInterface.success) {
        this.autocomplete.interfaces.availableFilter = this.tabs[this.selectedIndex].availableInterface = availableInterface.data;
        this.message.success('接口信息获取成功！');
      } else {
        if (availableInterface && !availableInterface.regConnected) {
          this.message.warning('注册中心当前未连接请稍后再试！');
        } else {
          this.message.warning('可用接口信息获取失败！');
        }
      }
    });
  }

  /**
   * 处理环境改变事件
   */
  handleEnvChange(): void {
    const tabInfo = this.tabs[this.selectedIndex];
    this.autocomplete.interfaces.availableFilter = tabInfo.availableInterface = [];
    this.initAvailableInterFace(tabInfo.selectEnv.tag, tabInfo.selectEnv.env);
    const interfaceName = tabInfo.formParams.get('interfaceName');
    interfaceName.markAsDirty();
    interfaceName.updateValueAndValidity();
    if (interfaceName.valid && interfaceName.value) {
      tabInfo.formParams.reset({url: '', interfaceName: interfaceName.value, method: '', version: '', group: ''});
      this.handleAutoFillingParam(interfaceName.value);
    }
  }

  /**
   * 处理自动完成选择事件
   * @param $event 事件
   */
  handleInterfaceAutocompleteSelect($event: NzAutocompleteOptionComponent): void {
    if ($event.nzValue) {
      this.handleAutoFillingParam($event.nzValue);
    }
  }

  /**
   * 解析选择的URL
   */
  resolveSelectURL(): void {
    this.resolveURL();
    this.modalShow.resolveUrlSelect = false;
  }

  /**
   * 上传之前检查
   * @param file NzUploadFile
   */
  beforeUpload = (file: NzUploadFile): boolean | Observable<boolean> => {
    const formParams = this.tabs[this.selectedIndex].formParams;
    const interfaceName = formParams.get('interfaceName');
    const method = formParams.get('method');
    interfaceName.markAsDirty();
    interfaceName.updateValueAndValidity();
    method.markAsDirty();
    method.updateValueAndValidity();
    if (!interfaceName.valid || !method.valid) {
      this.message.info('请先填写接口名和方法名！');
      return false;
    }
    // tslint:disable-next-line
    const exName = file.name.slice((file.name.lastIndexOf('.') - 1 >>> 0) + 2);
    if (exName === 'jar' || exName === 'zip' || exName === 'war') {
      return true;
    } else {
      this.message.error(`${file.name}不是正确的文件，支持的扩展名：jar或zip`);
      return false;
    }
    // tslint:disable-next-line
  };

  /**
   * 文件上传
   * @param item NzUploadXHRArgs
   */
  uploadRequest = (item: NzUploadXHRArgs): Subscription => {
    const formParams = this.tabs[this.selectedIndex].formParams;
    const interfaceName = formParams.get('interfaceName');
    const method = formParams.get('method');
    interfaceName.markAsDirty();
    interfaceName.updateValueAndValidity();
    method.markAsDirty();
    method.updateValueAndValidity();
    if (!interfaceName.valid || !method.valid) {
      this.message.info('请先填写接口名和方法名！');
      item.onError(null, item.file);
      return EMPTY.subscribe();
    }
    return this.genericService.uploadJar(item.postFile as Blob, interfaceName.value, method.value)
      .pipe(
        filter(event => {
          switch (event.type) {
            case HttpEventType.Response: {
              return true;
            }
            case HttpEventType.UploadProgress: {
              item.onProgress({percent: Math.round(event.loaded / event.total * 100).toFixed(2)}, item.file);
              return false;
            }
            default:
              return false;
          }
        }),
        map(it => (it as HttpResponse<MethodInfo[]>).body))
      .subscribe(info => {
          item.onSuccess(info, item.file, null);
          this.uploadFileList = [];
          if (info && info.length > 0) {
            if (info.length === 1) {
              this.parsingParameters(info[0]);
            } else {
              // 有重载
              this.methodInfoArray = info;
              this.modalShow.methodOverloading = true;
            }
          } else {
            this.message.warning('在上传的文件中没有找到该方法！');
          }
        },
        err => {
          item.onError(err, item.file);
          console.warn(err);
        },
        () => {
          item.onSuccess(null, item.file, null);
        });
    // tslint:disable-next-line
  };

  /**
   * 解析选择的方法
   */
  resolveSelectMethod(): void {
    if (this.resolveMethodInfo) {
      this.parsingParameters(this.resolveMethodInfo);
      this.message.success('选择成功');
    }
    this.modalShow.methodOverloading = false;
  }

  /**
   * Tab单击事件
   */
  handleTabClick(index: number): void {
    if (index !== this.selectedIndex) {
      return;
    }
    this.oldTab = this.tabs[index];
    this.modalShow.tabReName = true;
  }

  /**
   * TAB重命名
   */
  doTabReName(): void {
    if (!this.tabNameForReName) {
      this.message.warning('输入不能为空！');
      return;
    }
    this.oldTab.tabName = this.tabNameForReName;
    this.tabNameForReName = '';
    this.persistenceService.saveGenericParamInfo(this.tabs);
    this.modalShow.tabReName = false;
  }

  /**
   * maven请求
   */
  mavenRequest(): void {
    if (!this.validInterfaceNameAndMethod(this.tabs[this.selectedIndex])) {
      return;
    }
    this.modalShow.maven = true;
  }

  /**
   * 发起maven请求
   */
  doMaven(): void {
    const tabInfo = this.tabs[this.selectedIndex];
    const tabParam = this.validInterfaceNameAndMethod(tabInfo);
    if (!tabParam) {
      return;
    }
    if (this.mavenXmlTabIndex === 1) {
      this.mavenXml = this.util.genericMavenDependencyXml(this.mavenXmlInputValue);
    }
    if (!this.mavenXml || this.mavenXml === '') {
      this.message.warning('Maven坐标信息必填！');
      return;
    }
    this.mavenLoading = true;
    this.genericService.sendMavenParse(this.mavenXml).subscribe(result => {
      if (!result) {
        this.mavenLoading = false;
        return;
      }
      if (result.length > 0) {
        if (result.length === 1) {
          const mavenRequest = new MavenRequest();
          mavenRequest.echo = tabInfo.id;
          mavenRequest.interfaceName = tabParam.interfaceName.value;
          mavenRequest.methodName = tabParam.method.value;
          mavenRequest.dependency = this.util.genericMavenDependencyXml(result[0]);
          this.sendMavenRequest(mavenRequest);
        } else {
          this.mavenArtifacts = result;
          this.modalShow.mavenVersion = true;
        }
      } else {
        this.mavenLoading = false;
        this.message.info('没有找到可用的版本信息');
      }
    });
  }

  /**
   * 取消下载
   */
  cancelDownload(): void {
    this.modal.confirm({
      nzTitle: '确定取消下载？',
      nzContent: '取消后已经下载的进度将删除。',
      nzOnOk: () => this.genericService.cancelDownload(this.cancelToken)
        .subscribe(() => {
          this.modalShow.download = false;
          this.downloadSpeed = 0;
          this.downloadProgress = 0;
        })
    });
  }

  /**
   * 解析选择的maven信息
   */
  resolveSelectMavenVersion(): void {
    if (!this.resolveMavenArtifact) {
      this.message.warning('必须选择个版本号');
    }
    const tabInfo = this.tabs[this.selectedIndex];
    const result = this.validInterfaceNameAndMethod(tabInfo);
    if (!result) {
      return;
    }
    const mavenRequest = new MavenRequest();
    mavenRequest.echo = tabInfo.id;
    mavenRequest.interfaceName = result.interfaceName.value;
    mavenRequest.methodName = result.method.value;
    mavenRequest.dependency = this.util.genericMavenDependencyXml(this.resolveMavenArtifact);
    this.modalShow.mavenVersion = false;
    this.sendMavenRequest(mavenRequest);
  }

  /**
   * maven模态框关闭
   */
  onMavenClose(): void {
    this.mavenLoading = false;
    this.modalShow.maven = false;
  }

  /**
   * maven版本模态框关闭
   */
  onMavenVersionClose(): void {
    this.mavenLoading = false;
    this.modalShow.mavenVersion = false;
  }

  /**
   * 重新加载提示
   */
  reloadPrompt(): void {
    const tabInfo = this.tabs[this.selectedIndex];
    if (tabInfo.selectEnv && tabInfo.selectEnv.env !== '') {
      this.handleEnvChange();
    } else {
      this.message.warning('请先选择环境！');
    }
  }
}

/**
 * 接口提供者信息
 */
class ProviderInfo {
  url: string;
  info: string;

  constructor(url: string, info: string) {
    this.url = url;
    this.info = info;
  }
}

/**
 * 请求参数模型
 */
export type RequestParamModel = { [name: string]: RequestParamModel | string | string[] }[];

/**
 * 请求模型
 */
export type RequestModel = FormParamsInfo & { params: RequestParamModel };
