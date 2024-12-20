<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [koatty\_container](./koatty_container.md) &gt; [Container](./koatty_container.container.md)

## Container class

IOC Container

  Container  {<!-- -->IContainer<!-- -->}

**Signature:**

```typescript
export declare class Container implements IContainer 
```
**Implements:** [IContainer](./koatty_container.icontainer.md)

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [attachClassMetadata(type, decoratorNameKey, data, target, propertyName)](./koatty_container.container.attachclassmetadata.md) |  | attach data to class or property |
|  [attachPropertyData(decoratorNameKey, data, target, propertyName)](./koatty_container.container.attachpropertydata.md) |  | attach property data to class |
|  [get(identifier, type, args)](./koatty_container.container.get.md) |  | get instance from IOC container. |
|  [getApp()](./koatty_container.container.getapp.md) |  | get app |
|  [getClass(identifier, type)](./koatty_container.container.getclass.md) |  | get class from IOC container by identifier. |
|  [getClassMetadata(type, decoratorNameKey, target, propertyName)](./koatty_container.container.getclassmetadata.md) |  | get single data from class or property |
|  [getIdentifier(target)](./koatty_container.container.getidentifier.md) |  | get identifier from class |
|  [getInsByClass(target, args)](./koatty_container.container.getinsbyclass.md) |  | <p>get instance from IOC container by class.</p><p> T</p> |
|  [getInstance()](./koatty_container.container.getinstance.md) | <code>static</code> | <p>Static method to get the singleton instance of a class</p> |
|  [getMetadataMap(metadataKey, target, propertyKey)](./koatty_container.container.getmetadatamap.md) |  | <p>get metadata from class</p> |
|  [getPropertyData(decoratorNameKey, target, propertyName)](./koatty_container.container.getpropertydata.md) |  | get property data from class |
|  [getType(target)](./koatty_container.container.gettype.md) |  | get component type from class |
|  [listClass(type)](./koatty_container.container.listclass.md) |  | get all class from Container |
|  [listPropertyData(decoratorNameKey, target)](./koatty_container.container.listpropertydata.md) |  | list property data from class |
|  [reg(identifier, target, options)](./koatty_container.container.reg.md) |  | <p>registering an instance of a class to an IOC container.</p><p> T</p> |
|  [saveClass(type, module, identifier)](./koatty_container.container.saveclass.md) |  | save class to Container |
|  [saveClassMetadata(type, decoratorNameKey, data, target, propertyName)](./koatty_container.container.saveclassmetadata.md) |  | save meta data to class or property |
|  [savePropertyData(decoratorNameKey, data, target, propertyName)](./koatty_container.container.savepropertydata.md) |  | save property data to class |
|  [setApp(app)](./koatty_container.container.setapp.md) |  | set app |

