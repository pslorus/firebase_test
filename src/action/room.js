import moment from "moment";
import {
  firebaseDatabase as database,
  firebaseAuth,
  firebaseStorage
} from "../firebase";

export const createRoom = ({ id, name, people, messages = [] }) => ({
  type: "CREATE_ROOM",
  room: {
    id,
    name,
    people,
    messages
  }
});

export const startCreateRoom = (roomper = {}, showCreateError) => {
  return (dispatch, getState) => {
    const room = {
      name: roomper.name
    };
    return database.ref("rooms").once("value", snapshot => {
      const rooms = [];

      snapshot.forEach(childSnapshot => {
        rooms.push({
          ...childSnapshot.val()
        });
      });
      if (!rooms.find(r => r.name === room.name)) {
        return database
          .ref(`rooms/${room.name}`)
          .set(room)
          .then(ref => {
            return database
              .ref(`rooms/${room.name}/people/${roomper.people.id}`)
              .set(roomper.people)
              .then(() => {
                database
                  .ref(`users/${roomper.people.id}/rooms/${room.name}`)
                  .set({ roomName: room.name });

                dispatch(
                  createRoom({
                    ...roomper,
                    people: [roomper.people]
                  })
                );
                const perName = roomper.people.name;
                dispatch(
                  startSendMessage(
                    `${perName} created this room`,
                    room.name,
                    true
                  )
                ).then(() => {
                  dispatch(startListening(room.name));
                  window.location.href = `#/room/${room.name}`;
                });
              });
          });
      } else {
        return showCreateError();
      }
    });
  };
};

export const sendMessage = (message, roomName) => ({
  type: "SEND_MESSAGE",
  message,
  roomName
});

export const orderRoomsStartState = () => ({
  type: "ORDER_ROOMS_START_STATE"
});

export const startListening = roomName => {
  return (dispatch, getState) => {
    return database
      .ref(`rooms/${roomName}/messages`)
      .on("child_added", msgSnapshot => {
        if (getState().rooms.find(r => r.name === roomName)) {
          database
            .ref(`rooms/${roomName}/people`)
            .once("value", personSnapshot => {
              const message = msgSnapshot.val();
              dispatch(
                sendMessage({ ...message, id: msgSnapshot.key }, roomName)
              );
              dispatch(orderRoomsStartState());
              if (message.sender.displayName !== getState().auth.displayName) {
                // ipcRenderer.send('playNotif', message.sender.displayName, message.text);
                // const audio = new Audio("/sounds/notif.mp3");
                // audio.play();
              }
              const keyword =
                message.status && message.text.split(" ").splice(-1, 1)[0];
              if (keyword === "left") {
                dispatch(onLeft(roomName, message.sender.uid));
              } else if (keyword === "joined") {
                dispatch(
                  onJoined(roomName, personSnapshot.val()[message.sender.uid])
                );
              }
              const personID = getState().auth.uid;

              if (personID === message.sender.uid && keyword !== "left") {
                database
                  .ref(`rooms/${roomName}/people/${personID}`)
                  .update({ unread: 0, lastRead: message.createdAt })
                  .then(() => {
                    dispatch(
                      setUnread(roomName, personID, message.createdAt, 0)
                    );
                  });
              } else if (
                personID !== message.sender.uid &&
                moment(message.createdAt) >
                  moment(personSnapshot.val()[personID].lastRead)
              ) {
                database
                  .ref(`rooms/${roomName}/people/${personID}`)
                  .update({
                    unread: personSnapshot.val()[personID].unread + 1,
                    lastRead: message.createdAt
                  })
                  .then(() => {
                    dispatch(
                      setUnread(
                        roomName,
                        personID,
                        message.createdAt,
                        personSnapshot.val()[personID].unread + 1
                      )
                    );
                  });
              }
            });
        }
      });
  };
};

export const startSendMessage = (
  text,
  roomName,
  status = false,
  imgObj = {}
) => {
  return (dispatch, getState) => {
    const user = getState().auth;
    if (user) {
      const uid = user.uid;
      const displayName = user.displayName;
      const message = {
        sender: { uid, displayName },
        text,
        createdAt: moment().format(),
        status,
        ...imgObj
      };
      return database.ref(`rooms/${roomName}/messages`).push(message);
    }
  };
};

export const onLeft = (roomName, personID) => ({
  type: "ON_LEFT",
  roomName,
  personID
});

export const onJoined = (roomName, person) => ({
  type: "ON_JOINED",
  roomName,
  person
});

export const setUnread = (roomName, uid, time, unread) => {
  return dispatch => {
    dispatch(clearUnread(roomName, uid, time, unread));
  };
};

export const clearUnread = (roomName, uid, time, unread) => ({
  type: "CLEAR_UNREAD",
  roomName,
  uid,
  time,
  unread
});

export const startJoinRoom = (data = {}, showJoinError) => {
  return (dispatch, getState) => {
    const state = getState();
    return database.ref(`rooms/${data.roomName}`).once("value", snapshot => {
      const value = snapshot.val();
      const id = data.id;
      if (value === null) {
        return showJoinError("Room not found!");
      } else if (value.people && value.people[id]) {
        window.location.href = `#/room/${data.roomName}`;
      } else {
        dispatch(startListening(data.roomName));
        const person = {
          name: data.name,
          id: data.id,
          unread: data.unread,
          lastRead: 0
        };
        let people = [];
        let messages = [];
        for (var key in value.people) {
          people.push({
            id: value.people[key].id,
            name: value.people[key].name,
            unread: value.people[key].unread,
            lastRead: value.people[key].lastRead
          });
        }
        for (var key in value.messages) {
          messages.push({
            ...value.messages[key]
          });
        }
        return database
          .ref(`rooms/${data.roomName}/people/${person.id}`)
          .set(person)
          .then(ref => {
            database
              .ref(`users/${person.id}/rooms/${data.roomName}`)
              .set({ roomName: data.roomName });

            dispatch(
              createRoom({
                people: [...people, person],
                name: data.roomName,
                messages
              })
            );
            const perName = person.name;

            dispatch(
              startSendMessage(`${perName} joined`, data.roomName, true)
            );

            window.location.href = `#/room/${data.roomName}`;
          });
      }
    });
  };
};

export const sendImageAct = (file, roomName) => dispatch => {
  // 2 - Upload the image to Cloud Storage.
  var filePath =
    firebaseAuth.currentUser.uid + "/" + roomName + "/" + file.name;
  return firebaseStorage
    .ref(filePath)
    .put(file)
    .then(function(fileSnapshot) {
      // 3 - Generate a public URL for the file.
      return fileSnapshot.ref.getDownloadURL().then(url => {
        // 4 - Update the chat message placeholder with the image's URL.
        return dispatch(
          startSendMessage("sendImage", roomName, false, {
            imageUrl: url,
            storageUri: fileSnapshot.metadata.fullPath
          })
        );
      });
    });
};
