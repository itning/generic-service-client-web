import {Injectable} from '@angular/core';
import {RequestModel} from '../module/generic/component/attribute/attribute.component';
import {HttpClient, HttpEvent, HttpParams} from '@angular/common/http';
import {Observable, Subject} from 'rxjs';
import {map, mergeMap} from 'rxjs/operators';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {environment} from '../../environments/environment';
import {v4 as uuidv4} from 'uuid';
import {NzMessageService} from 'ng-zorro-antd/message';
import {AutocompleteDataSource} from 'ng-zorro-antd/auto-complete/autocomplete.component';

@Injectable({
  providedIn: 'root'
})
export class GenericService {

  private token: string;
  private resultSubject: Subject<WebSocketResultModel>;

  constructor(private http: HttpClient,
              private message: NzMessageService,
              private fb: FormBuilder) {
  }

  sendGenericRequest(requestModel: RequestModel, echo: string): Observable<string> {
    return this.getWebSocketToken().pipe(mergeMap(token => {
      // tslint:disable-next-line
      requestModel['token'] = token;
      // tslint:disable-next-line
      requestModel['echo'] = echo;
      return this.http.post(`http://${environment.baseUrl}/dubbo/invoke`, requestModel, {responseType: 'text'});
    }));
  }

  sendMavenRequest(mavenRequest: MavenRequest): Observable<MavenResponse<void>> {
    return this.getWebSocketToken().pipe(mergeMap(token => {
      mavenRequest.token = token;
      return this.http.post<MavenResponse<void>>(`http://${environment.baseUrl}/nexus/dependency/download`, mavenRequest);
    }));
  }

  sendMavenParse(dep: string): Observable<Artifact[]> {
    return this.http.post<MavenResponse<Artifact[]>>(`http://${environment.baseUrl}/nexus/dependency/parse`,
      new HttpParams({fromObject: {dependency: dep}}),
      {headers: {'Content-Type': 'application/x-www-form-urlencoded'}})
      .pipe(map(it => {
        if (!it || !it.success) {
          this.message.error(it.message);
          return null;
        } else {
          return it.data;
        }
      }));
  }

  cancelDownload(cancelToken: string): Observable<void> {
    return this.http.get<void>(`http://${environment.baseUrl}/nexus/dependency/download/cancel?token=${cancelToken}`);
  }

  getAvailableEnv(): Observable<string[]> {
    return this.http.get<string[]>(`http://${environment.baseUrl}/service/env`);
  }

  getAvailableInterFaces(tag: string, env: string): Observable<ServiceInfo> {
    return this.http.get<ServiceInfo>(`http://${environment.baseUrl}/service/providers?env=${env}&tag=${tag}`);
  }

  getURL(env: string, tag: string, interfaceName: string): Observable<ServiceInfo> {
    return this.http
      .get<ServiceInfo>(`http://${environment.baseUrl}/service/provideDetail?env=${env}&tag=${tag}&interfaceName=${interfaceName}`);
  }

  uploadJar(file: Blob, interfaceName: string, methodName: string): Observable<HttpEvent<MethodInfo[]>> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    formData.append('interfaceName', interfaceName);
    formData.append('methodName', methodName);
    return this.http.post<MethodInfo[]>(`http://${environment.baseUrl}/jar/upload`, formData, {reportProgress: true, observe: 'events'});
  }

  getWebSocketToken(): Observable<string> {
    if (!this.token) {
      return this.http.get(`http://${environment.baseUrl}/socket_token`, {responseType: 'text'}).pipe(
        map(i => {
          if (this.token) {
            return this.token;
          }
          this.token = i;
          return i;
        })
      );
    } else {
      return new Observable(subscriber => {
        subscriber.next(this.token);
        subscriber.complete();
      });
    }
  }

  generateFormParams(url = '',
                     interfaceName = '',
                     method = '',
                     version = '',
                     group = '',
                     path = ''): FormGroup {
    return this.fb.group({
      url: [url, [Validators.required]],
      interfaceName: [interfaceName, [Validators.required]],
      method: [method, [Validators.required]],
      version: [version, []],
      group: [group, []],
      path: [path]
    });
  }

  private initWebSocket(url: string): Observable<string> {
    const ws = new WebSocket(url);
    window.onbeforeunload = () => {
      if (ws) {
        ws.close();
      }
    };
    return new Observable<string>(
      observer => {
        ws.onopen = () => observer.next('0||服务器连接成功！');
        ws.onmessage = (event) => observer.next(event.data);
        ws.onerror = (event) => observer.error(event);
        ws.onclose = () => {
          observer.next('0||服务器已关闭，请刷新页面后再试！');
          observer.complete();
        };
      });
  }

  private getRealValue(item: Item): string | number | boolean | null {
    switch (item.type) {
      case Type.STRING:
      case Type.DATE:
      case Type.DATE_8601:
        return item.attributeValue as string;
      case Type.NUMBER:
        const value = Number(item.attributeValue);
        if (Number.isNaN(value)) {
          this.message.error(`${item.attributeValue}非数字！`);
          throw new Error(`${item.attributeValue}非数字！`);
        }
        return value;
      case Type.BOOLEAN:
        return item.attributeValue === 'true';
      default:
        console.error(`非法调用 Type:${item.type}`);
        return null;
    }
  }

  connectionResultWebSocket(token: string): Observable<WebSocketResultModel> {
    return this.initWebSocket(`ws://${environment.baseUrl}/p?token=${token}`)
      .pipe(map(it => {
        const echoEndIndex = it.indexOf('|', 2);
        const type = Number(it.charAt(0)) as WebSocketMessageType;
        const echo = it.substring(2, echoEndIndex);
        const message = it.substring(echoEndIndex + 1);
        return new WebSocketResultModel(type, echo, message);
      }));
  }

  connectionResultWebSocketReply(): Subject<WebSocketResultModel> {
    if (this.resultSubject) {
      return this.resultSubject;
    }
    this.resultSubject = new Subject<WebSocketResultModel>();
    this.getWebSocketToken().pipe(mergeMap(token => this.connectionResultWebSocket(token))).subscribe(this.resultSubject);
    return this.resultSubject;
  }

  connectionLogWebSocket(): Observable<string> {
    return this.initWebSocket(`ws://${environment.baseUrl}/log`).pipe(map(it => {
      if (it.startsWith('0||')) {
        it = it.substring(3);
      }
      return it;
    }));
  }

  /**
   * 转换请求
   * @param items 参数列表
   * @private
   */
  conversionRequest(items: Item[]): any {
    const r = [];
    items.forEach(item => {
      const re = {};
      if (item.type === Type.OBJECT) {
        re[item.attributeName] = this.conversionRequestForItem(item.attributeValue as Item[]);
      } else if (item.type === Type.ARRAY) {
        re[item.attributeName] = this.conversionRequestForItemArray(item.attributeValue as Item[]);
      } else {
        re[item.attributeName] = this.getRealValue(item);
      }
      r.push(re);
    });
    return r;
  }

  conversionRequestForItem(items: Item[]): any {
    const result = {};
    items.map(item => {
      if (item.type === Type.OBJECT) {
        result[item.attributeName] = this.conversionRequestForItem(item.attributeValue as Item[]);
      } else if (item.type === Type.ARRAY) {
        result[item.attributeName] = (item.attributeValue as Item[]).map(it => {
          if (it.type === Type.OBJECT) {
            return this.conversionRequestForItem(it.attributeValue as Item[]);
          } else if (it.type === Type.ARRAY) {
            return this.conversionRequestForItemArray(it.attributeValue as Item[]);
          } else {
            return this.getRealValue(it);
          }
        });
      } else {
        result[item.attributeName] = this.getRealValue(item);
      }
    });
    return result;
  }

  conversionRequestForItemArray(items: Item[]): any {
    return items.map(it => {
      if (it.type === Type.OBJECT) {
        return this.conversionRequestForItem(it.attributeValue as Item[]);
      } else if (it.type === Type.ARRAY) {
        return this.conversionRequestForItemArray(it.attributeValue as Item[]);
      } else {
        return this.getRealValue(it);
      }
    });
  }
}

export class Artifact {
  groupId: string;
  artifactId: string;
  version: string;
}

export class MavenRequest {
  token: string;
  echo: string;
  dependency: string;
  interfaceName: string;
  methodName: string;
}

export class MavenResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export class WebSocketResultModel {
  type: WebSocketMessageType;
  message: string;
  echo: string;

  constructor(type: WebSocketMessageType, echo: string, message: string) {
    this.type = type;
    this.message = message;
    this.echo = echo;
  }
}

export enum WebSocketMessageType {
  PLAINTEXT,
  JSON,
  NEXUS_DOWNLOAD_CANCEL_TOKEN,
  NEXUS_DOWNLOAD_PROGRESS,
  NEXUS_DOWNLOAD_SUCCESS,
  NEXUS_DOWNLOAD_FAILED
}

export type AttributeNameType = string | undefined;
export type AttributeValueType = Item | number | string | boolean | number[] | string[] | Item[] | boolean[] | undefined;

/**
 * 参数每一项
 */
export class Item {
  id: string;
  attributeName: AttributeNameType;
  attributeValue: AttributeValueType;
  type: Type;
  placeholder: string;
  autoComplete: AutocompleteDataSource = [];
  show: boolean;
  use: boolean;
  attributeValueDate: Date;

  static generate(type: Type,
                  attributeName: AttributeNameType,
                  attributeValue: AttributeValueType,
                  placeholder?: string,
                  autoComplete?: AutocompleteDataSource,
                  attributeValueDate?: Date): Item {
    const item = new Item();
    item.id = uuidv4();
    item.type = type;
    item.attributeName = attributeName;
    item.attributeValue = attributeValue;
    item.placeholder = placeholder;
    item.autoComplete = autoComplete;
    item.show = true;
    item.use = true;
    item.attributeValueDate = attributeValueDate;
    return item;
  }

  static generateObject(attributeName: AttributeNameType, attributeValue: AttributeValueType): Item {
    return Item.generate(Type.OBJECT, attributeName, attributeValue);
  }

  static generateArray(attributeName: AttributeNameType, attributeValue: AttributeValueType): Item {
    return Item.generate(Type.ARRAY, attributeName, attributeValue);
  }

  static generateString(attributeName: AttributeNameType,
                        attributeValue: AttributeValueType,
                        placeholder = '',
                        autoComplete: AutocompleteDataSource = []): Item {
    return Item.generate(Type.STRING, attributeName, attributeValue, placeholder, autoComplete);
  }

  static generateNumber(attributeName: AttributeNameType,
                        attributeValue: AttributeValueType,
                        placeholder = '',
                        autoComplete: AutocompleteDataSource = []): Item {
    return Item.generate(Type.NUMBER, attributeName, attributeValue, placeholder);
  }

  static generateBoolean(attributeName: AttributeNameType,
                         attributeValue: AttributeValueType,
                         placeholder = '',
                         autoComplete: AutocompleteDataSource = []): Item {
    return Item.generate(Type.BOOLEAN, attributeName, attributeValue, placeholder);
  }

  static generateDate(attributeName: AttributeNameType,
                      attributeValue: AttributeValueType,
                      placeholder = '',
                      autoComplete: AutocompleteDataSource = [],
                      attributeValueDate: Date): Item {
    return Item.generate(Type.DATE, attributeName, attributeValue, placeholder, autoComplete, attributeValueDate);
  }

  static generateDATE_8601(attributeName: AttributeNameType,
                           attributeValue: AttributeValueType,
                           placeholder = '',
                           autoComplete: AutocompleteDataSource = [],
                           attributeValueDate: Date): Item {
    return Item.generate(Type.DATE_8601, attributeName, attributeValue, placeholder, autoComplete, attributeValueDate);
  }
}

export enum Type {
  STRING,
  NUMBER,
  BOOLEAN,
  ARRAY,
  OBJECT,
  DATE,
  DATE_8601
}

/**
 * TAB页信息
 */
export class TabInfo {
  id: string;
  tabName: string;
  formParams: FormGroup;
  parameterValue: Item[] = [];
  resultData: string[] = [];

  constructor(id: string, tabName: string, formParams: FormGroup, parameterValue: Item[], resultData: string[]) {
    this.id = id;
    this.tabName = tabName;
    this.formParams = formParams;
    this.parameterValue = parameterValue;
    this.resultData = resultData;
  }
}

export class ServiceInfo {
  success: boolean;
  regConnected: boolean;
  updateTime: string;
  env: string;
  data: string[];
}

export class MethodInfo {
  signature: string;
  paramClassName: string[];
  property: { [key: string]: any }[];
}
