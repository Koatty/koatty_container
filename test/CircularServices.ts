import { Autowired } from "../src/decorator/Autowired";
import { Component } from "../src/decorator/Component";

// normal non-circular dependency
@Component()
export class DatabaseService {
  connect() {
    return "connected";
  }
}

@Component()
export class UserRepository {
  @Autowired("DatabaseService")
  databaseService: DatabaseService;

  findUser() {
    return "user found";
  }
}

// simple bidirectional circular dependency - use string identifiers
@Component()
export class UserService {
  @Autowired("OrderService")
  orderService: any;

  getUser() {
    return "user";
  }
}
@Component()
export class OrderService {
  @Autowired("UserService")
  userService: any;

  getOrder() {
    return "order";
  }
}

// circular dependency with lazy loading
@Component()
export class NotificationService {
  @Autowired("PaymentService")
  paymentService: any;

  sendNotification() {
    return "notification sent";
  }
}
@Component()
export class PaymentService {
  @Autowired("NotificationService", "COMPONENT", [], true)
  notificationService: any;

  processPayment() {
    return "payment processed";
  }
}

// test circular dependency classes
@Component()
export class ServiceA {
  @Autowired("ServiceB")
  serviceB: any;

  getValue() {
    return "A";
  }
}

@Component()
export class ServiceB {
  @Autowired("ServiceC")
  serviceC: any;

  getValue() {
    return "B";
  }
}
@Component()
export class ServiceC {
  @Autowired("ServiceA")
  serviceA: any;

  getValue() {
    return "C";
  }
} 