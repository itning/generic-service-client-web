import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {NzModalService} from 'ng-zorro-antd/modal';
import {v4 as uuidv4} from 'uuid';
import {FormParamsInfo, PersistenceService} from '../../../../service/persistence.service';
import {AttributeValueType, GenericService, Item, MethodInfo, TabInfo, Type} from '../../../../service/generic.service';
import JSONEditor from 'jsoneditor';
import {NzMessageService} from 'ng-zorro-antd/message';
import {UtilsService} from '../../../../service/utils.service';
import {NzAutocompleteOptionComponent} from 'ng-zorro-antd/auto-complete';
import {NzUploadFile, NzUploadXHRArgs} from 'ng-zorro-antd/upload/interface';
import {EMPTY, Observable, Subscription} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {AutocompleteDataSource} from 'ng-zorro-antd/auto-complete/autocomplete.component';

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

  @Input()
  isRequestLoading: boolean;
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
    tabReName: false
  };

  /**
   * 自动完成
   */
  autocomplete = {
    interfaces: {
      available: [],
      availableFilter: []
    },
    methods: {
      available: [],
      availableFilter: []
    }
  };

  /**
   * 用户填的解析URL值
   */
  resolveURLValue: string;

  /**
   * 用户当前选择的环境
   */
  selectEnv: string;

  /**
   * 所有可用的环境
   */
  availableEnv: string[] = [];

  /**
   * 多个提供者信息
   */
  providerInfoArray: ProviderInfo[] = [];

  uploadFileList: NzUploadFile[];

  methodInfoArray: MethodInfo[];

  resolveMethodInfo: MethodInfo;

  oldTab: TabInfo;

  tabNameForReName: string;

  constructor(private fb: FormBuilder,
              private modal: NzModalService,
              private persistenceService: PersistenceService,
              private genericService: GenericService,
              private message: NzMessageService,
              private util: UtilsService) {
  }

  ngOnInit(): void {
    this.genericService.getAvailableEnv().subscribe((availableEnv) => {
      this.availableEnv = availableEnv;
      if (availableEnv && availableEnv.length > 1) {
        this.selectEnv = availableEnv[0];
        this.initAvailableInterFace(availableEnv[0]);
      } else {
        console.log('Zookeeper当前未连接请稍后再试！');
      }
    });
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
      uuidv4(),
      'Unnamed Tab',
      this.fb.group({
        url: ['', [Validators.required]],
        interfaceName: ['', [Validators.required]],
        method: ['', [Validators.required]],
        version: ['', []],
        group: ['', []]
      }),
      [], []));
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
    this.autocomplete.methods.availableFilter = this.autocomplete.methods.available;
    this.autocomplete.interfaces.availableFilter = this.autocomplete.interfaces.available;
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
    this.genericService.getURL(this.selectEnv, interfaceName).subscribe(url => {
      if (url && url.success && url.nodes && url.nodes.length > 0) {
        if (url.nodes.length === 1) {
          this.resolveURLValue = decodeURIComponent(url.nodes[0]);
          this.resolveURL();
        } else {
          this.providerInfoArray = url.nodes.map(item => {
            item = decodeURIComponent(item);
            const host = item.substring(8, item.indexOf('/', 8));
            const group = this.util.getParamValue(item, 'group');
            const version = this.util.getParamValue(item, 'version');
            return new ProviderInfo(item, `主机：${host} 分组：${group} 版本：${version}`);
          });
          this.message.info('有多个提供者，请选择一个！');
          this.modalShow.resolveUrlSelect = true;
        }
      } else {
        this.autocomplete.methods.available = this.autocomplete.methods.availableFilter = [];
        if (url && !url.zkConnected) {
          this.message.warning('Zookeeper当前未连接请稍后再试！');
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
    const tabInfo = this.tabs[this.selectedIndex];
    tabInfo.formParams.setValue({url: host, interfaceName, group, version, method: ''});
    this.autocomplete.methods.availableFilter = this.autocomplete.methods.available = methods.split(',');
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
    this.autocomplete.methods.availableFilter = this.autocomplete.methods.available.filter(item => item.indexOf(value) !== -1);
  }


  /**
   * 可用方法过滤
   * @param $event Event
   */
  availableInterFacesAutoCompleteFilter($event: Event): void {
    $event.preventDefault();
    const value = ($event.target as HTMLInputElement).value;
    this.autocomplete.interfaces.availableFilter = this.autocomplete.interfaces.available.filter(item => item.indexOf(value) !== -1);
  }

  /**
   * 初始化可用接口信息
   * @param env 环境
   */
  initAvailableInterFace(env: string): void {
    this.genericService.getAvailableInterFaces(env).subscribe((availableInterface) => {
      if (availableInterface && availableInterface.success) {
        this.autocomplete.interfaces.availableFilter = this.autocomplete.interfaces.available = availableInterface.nodes;
      } else {
        if (availableInterface && !availableInterface.zkConnected) {
          this.message.warning('Zookeeper当前未连接请稍后再试！');
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
    this.autocomplete.interfaces.availableFilter = this.autocomplete.interfaces.available = [];
    this.initAvailableInterFace(this.selectEnv);
    const tabInfo = this.tabs[this.selectedIndex];
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
   * @param fileList NzUploadFile[]
   */
  beforeUpload = (file: NzUploadFile, fileList: NzUploadFile[]): boolean | Observable<boolean> => {
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
}

class ProviderInfo {
  url: string;
  info: string;

  constructor(url: string, info: string) {
    this.url = url;
    this.info = info;
  }
}

export type RequestParamModel = { [name: string]: RequestParamModel | string | string[] }[];
export type RequestModel = FormParamsInfo & { params: RequestParamModel };
