import React from "react";
import { connect } from "react-redux";
import { Row, Col, Button, Input } from "reactstrap";

import { startSendMessage, sendImageAct } from "../action/room";
import moment from "moment";

class Room extends React.Component {
  onSend = e => {
    const message = document.getElementById("input-message").value;

    if (!message.trim()) {
      return;
    }

    this.props.dispatch(startSendMessage(message, this.props.roomName));
    document.getElementById("input-message").value = "";
  };

  displayMessages = () => {
    const { messages } = this.props;
    if (typeof messages === "string") {
      return <Col className="message__time">{messages}</Col>;
    }
    let a = [],
      prevSender;
    // console.log(messages);
    messages.forEach(message => {
      const name = (
        <p className="message__name">{message.sender.displayName}</p>
      );
      const time = (
        <p className="message__time">
          {moment(message.createdAt).format("h:mm:ss a, MMMM Do YYYY, dddd")}
        </p>
      );
      const text = <p className="message__text">{message.text}</p>;
      const image = message.imageUrl ? <img src={message.imageUrl} /> : null;
      console.log("message", message);
      // console.log(prevSender, messages[key].sender.displayName)
      if (message.status) {
        a.push(
          <Row key={message.id} className="message-with-status">
            {text}
            {time}
          </Row>
        );
        prevSender = null;
      } else if (prevSender === message.sender.uid) {
        a.push(
          <Row key={message.id} className="message">
            {time}
            {text}
            {image}
          </Row>
        );
      } else {
        prevSender = message.sender.uid;
        a.push(
          <Row key={message.id} className="message">
            {name}
            {time}
            {text}
            {image}
          </Row>
        );
      }
    });
    // a.push(<li key="" tabIndex="1"></li>);
    return a;
  };

  sendImage = ({ target }) => {
    this.props.dispatch(sendImageAct(target.files[0], this.props.roomName));
    console.log("file", target.files[0]);
  };

  render() {
    return (
      <Col>
        <Row>
          <Col>{this.displayMessages(this.props.messages)}</Col>
          {
            // <Col
            //   ref={el => {
            //     this.messagesEnd = el;
            //   }}
            // />
          }
        </Row>
        <Row>
          <Input id="input-message" placeholder="send message" />
          <Button onClick={this.onSend}>Send</Button>
        </Row>
        <Row>
          <Input type="file" onChange={this.sendImage} />
        </Row>
      </Col>
    );
  }
}

export default connect(
  (state, props) => {
    const { rooms } = state;
    const roomName = props.location.pathname.split("/").slice(-1)[0];
    const a = rooms.filter(room => room.name === roomName)[0];
    const b = a ? a.messages : "Loading...";
    return {
      messages: b,
      roomName
    };
  },
  dispatch => ({ dispatch })
)(Room);
